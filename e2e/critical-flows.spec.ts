import { expect, test } from '@playwright/test';
import { format } from 'date-fns';
import { formatDate } from '../lib/format-date';
import { E2E_EMAIL, E2E_PASSWORD } from './test-user';

test('landlord can manage a property from sign-in through rent collection', async ({ page }) => {
  test.setTimeout(90_000);
  const currentMonthStart = format(new Date(), 'yyyy-MM-01');
  let unitUrl = '';

  await test.step('protected pages require authentication', async () => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/authenticate$/);
    await expect(page.getByText('Sign in to 8TURF', { exact: true })).toBeVisible();
  });

  await test.step('admin can sign in', async () => {
    await page.getByLabel('Email').fill(E2E_EMAIL);
    await page.getByLabel('Password').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
  });

  await test.step('admin can create a property', async () => {
    await page.getByRole('button', { name: 'New property' }).click();
    await page.getByLabel('Name').fill('E2E Apartments');
    await page
      .getByLabel('Address')
      .fill('Block 1 Lot 8 Vista Del Rio Subdivision Brgy. Alimanao, Penablanca, Cagayan');
    await page.getByRole('button', { name: 'Create property' }).click();
    await expect(page.getByRole('heading', { name: 'E2E Apartments' })).toBeVisible();
    await expect(
      page.getByText('Block 1 Lot 8 Vista Del Rio Subdivision Brgy. Alimanao, Penablanca, Cagayan'),
    ).toBeVisible();
  });

  await test.step('admin can add a unit', async () => {
    await page.getByRole('button', { name: 'Add unit' }).click();
    await page.getByLabel('Unit label').fill('Unit A');
    await page.getByLabel('Bedrooms').fill('2');
    await page.getByLabel('Bathrooms').fill('1');
    await page.getByLabel('Asking rent (₱/mo)').fill('12500');
    await page.getByRole('button', { name: 'Add unit' }).click();
    await expect(page).toHaveURL(/\/units\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Unit A' })).toBeVisible();
    await expect(page.getByText('₱ 12,500.00/mo asking')).toBeVisible();
    unitUrl = page.url();
  });

  await test.step('financial report shows vacancy loss for month and year filters', async () => {
    await page.goto('/financial-report');
    await expect(page.getByRole('heading', { name: 'Financial Report' })).toBeVisible();

    const monthRow = page.getByRole('row', { name: /Unit A/ });
    await expect(monthRow.getByRole('cell', { name: '₱ 12,500.00' })).toBeVisible();

    await page.getByLabel('Report period').selectOption('year');
    await expect(page).toHaveURL(/mode=year/);
    const yearRow = page.getByRole('row', { name: /Unit A/ });
    await expect(yearRow.getByRole('cell', { name: '₱ 12,500.00' })).toBeVisible();

    await page.goto(unitUrl);
  });

  await test.step('admin can assign a tenant', async () => {
    await page.getByLabel('Name').fill('Tenant One');
    await page.getByLabel('Email').fill('tenant@example.com');
    await page.getByLabel('Phone (optional)', { exact: true }).fill('09171234567');
    await page.locator('input[name="leaseStartDate"]').evaluate((input, value) => {
      (input as HTMLInputElement).value = value;
    }, currentMonthStart);
    await page.getByRole('button', { name: 'Assign tenant' }).click();
    await expect(page.getByText('Tenant One')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment Ledger' })).toBeVisible();
  });

  await test.step('admin can record a partial rent payment', async () => {
    const paymentForm = page
      .getByRole('button', { name: 'Record payment' })
      .locator('xpath=ancestor::form');
    await paymentForm.locator('input[name="amountDollars"]').fill('5000');
    await paymentForm.locator('select[name="method"]').selectOption('cash');
    await paymentForm.locator('input[name="notes"]').fill('E2E partial payment');
    await paymentForm.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByRole('cell', { name: '₱ 5,000.00' })).toBeVisible();
    await expect(page.getByText('Partial', { exact: true })).toBeVisible();
  });

  await test.step('portfolio views reflect the payment', async () => {
    // Lease starts on the 1st, so the derived due date is the 1st of this month;
    // Payments Overview and the Billing report must render the same date.
    const dueDateLabel = formatDate(currentMonthStart);

    await page.goto('/payments');
    await expect(page.getByRole('heading', { name: 'Payments Overview' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Tenant One' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '₱ 5,000.00' })).toBeVisible();
    await expect(page.getByRole('table').getByText('Partial', { exact: true })).toBeVisible();
    const paymentsRow = page.getByRole('row', { name: /Unit A/ });
    await expect(paymentsRow.getByRole('cell', { name: dueDateLabel })).toBeVisible();

    await page.goto('/reports/billing');
    await expect(page.getByRole('heading', { name: 'Monthly Billing Report' })).toBeVisible();
    const billingRow = page.getByRole('row', { name: /Unit A/ });
    await expect(billingRow.getByRole('cell', { name: dueDateLabel })).toBeVisible();
    await expect(billingRow.getByRole('cell', { name: '₱ 5,000.00' })).toBeVisible();

    await page.goto('/dashboard');
    await expect(page.locator('section').getByText('₱ 5K', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /E2E Apartments/ }).getByText('1 partial', { exact: true }),
    ).toBeVisible();

    await page.goto('/financial-report');
    const reportRow = page.getByRole('row', { name: /Unit A/ });
    await expect(reportRow.getByRole('cell', { name: '₱ 5,000.00' })).toBeVisible();
    await expect(reportRow.getByRole('cell', { name: '₱ 0.00' })).toHaveCount(2);
  });

  await test.step('property addresses fit within a mobile viewport', async () => {
    for (const width of [320, 390, 500, 640]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/dashboard');

      const propertyCard = page.getByRole('link', { name: /E2E Apartments/ });
      const address = propertyCard.getByText(
        'Block 1 Lot 8 Vista Del Rio Subdivision Brgy. Alimanao, Penablanca, Cagayan',
      );

      await expect(propertyCard).toBeVisible();
      await expect(address).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      expect(
        await propertyCard.evaluate(
          (element) => element.getBoundingClientRect().right <= window.innerWidth,
        ),
      ).toBe(true);
      expect(await address.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe(
        'normal',
      );
    }
  });
});
