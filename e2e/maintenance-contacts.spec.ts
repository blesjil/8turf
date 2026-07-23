import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD, E2E_USER_EMAIL, E2E_USER_PASSWORD } from './test-user';

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  // The first streamed response from `next start` intermittently aborts
  // (net::ERR_ABORTED) before `load`; a single retry settles it.
  await page.goto('/authenticate').catch(() => page.goto('/authenticate'));
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
}

test('maintenance contacts are searchable, editable, archivable, and owner scoped', async ({
  page,
}) => {
  page.on('pageerror', (error) => console.error('Browser page error:', error.stack));
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('Browser console error:', message.text());
  });

  await test.step('admin creates a maintenance contact', async () => {
    await signIn(page, E2E_EMAIL, E2E_PASSWORD);
    await page.getByRole('link', { name: 'Contacts' }).click();
    await expect(
      page.getByRole('heading', { name: 'Maintenance Contacts', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('No maintenance contacts yet')).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add contact' }).click();
    const addDialog = page.getByRole('dialog', { name: 'Add maintenance contact' });
    await addDialog.getByLabel('Name').fill('Mario Santos');
    await addDialog.getByLabel('Company').fill('Santos Home Repair');
    await addDialog.getByLabel('Plumber').check();
    await addDialog.getByLabel('Handyman / Repair').check();
    await addDialog.getByLabel('Phone').fill('09171234567');
    await addDialog.getByLabel('Service area').fill('Cagayan');
    await addDialog.getByLabel('Availability').fill('Mon–Sat, 8am–6pm');
    await addDialog.getByRole('button', { name: 'Add contact' }).click();
    await expect(page.getByRole('heading', { name: 'Contact saved' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(page.getByRole('table').getByText('Mario Santos', { exact: true })).toBeVisible();
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: 'Plumber' }).first(),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Call Mario Santos' })).toHaveAttribute(
      'href',
      'tel:09171234567',
    );
  });

  await test.step('admin filters, marks preferred, and edits the contact', async () => {
    await page.getByRole('combobox', { name: 'Service', exact: true }).selectOption('plumber');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/service=plumber/);
    await expect(page.getByRole('table').getByText('Mario Santos', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Mark Mario Santos as preferred' }).first().click();
    await expect(
      page.getByRole('button', { name: 'Unmark Mario Santos as preferred' }).first(),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Edit Mario Santos' }).first().click();
    const editDialog = page.getByRole('dialog', { name: 'Edit Mario Santos' });
    await editDialog.getByLabel('Email').fill('mario@example.com');
    await editDialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'Contact saved' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('link', { name: 'Email Mario Santos' })).toHaveAttribute(
      'href',
      'mailto:mario@example.com',
    );
  });

  await test.step('admin archives and restores the contact', async () => {
    await page.getByRole('button', { name: 'Archive Mario Santos' }).first().click();
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(page.getByText('No contacts match these filters')).toBeVisible();

    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('archived');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('table').getByText('Mario Santos', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Restore Mario Santos' }).first().click();
    await expect(page.getByText('No contacts match these filters')).toBeVisible();
  });

  await test.step('regular users cannot see another owner’s contacts', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await signIn(page, E2E_USER_EMAIL, E2E_USER_PASSWORD);
    await page.goto('/maintenance/contacts');
    await expect(page.getByText('No maintenance contacts yet')).toBeVisible();
    await expect(page.getByLabel('Owner')).toHaveCount(0);
  });

  await test.step('the empty mobile directory does not overflow', async () => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/maintenance/contacts');
    await expect(
      page.getByRole('heading', { name: 'Maintenance Contacts', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
