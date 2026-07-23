import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// nodemailer is mocked so no SMTP connection is made; sendMail is a spy we can
// inspect. vi.hoisted lets the mock factory reach the shared spies.
const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock('nodemailer', () => ({ default: { createTransport } }));

const receipt = {
  tenantName: 'Ana',
  propertyName: 'Sunrise',
  unitLabel: '2B',
  amount: 150000,
  paidDate: '2026-07-09',
  periodStart: '2026-07-01',
  periodEnd: '2026-07-31',
  paymentType: 'rental',
  method: 'gcash',
};

const reminder = {
  tenantName: 'Ana',
  propertyName: 'Sunrise',
  unitLabel: '2B',
  monthLabel: 'July 2026',
  dueDate: '2026-07-05',
  rentAmount: 100000,
  amountPaid: 40000,
  amountDue: 60000,
};

async function loadMail(configured: boolean, extraEnv: Record<string, string> = {}) {
  vi.resetModules();
  // getTransporter caches the transport on globalThis; clear it between loads.
  delete (globalThis as { mailTransporter?: unknown }).mailTransporter;
  sendMail.mockReset();
  sendMail.mockResolvedValue({ messageId: 'x' });
  createTransport.mockClear();
  vi.stubEnv('GMAIL_USER', configured ? 'landlord@8turf.com' : '');
  vi.stubEnv('GMAIL_APP_PASSWORD', configured ? 'app-pass' : '');
  for (const [k, v] of Object.entries(extraEnv)) vi.stubEnv(k, v);
  return import('@/lib/mail');
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('sendPaymentReceipt', () => {
  it('skips sending when the mailer is unconfigured', async () => {
    const { sendPaymentReceipt } = await loadMail(false);
    await sendPaymentReceipt('ana@example.com', receipt);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends a receipt with amount, covered month, and method', async () => {
    const { sendPaymentReceipt } = await loadMail(true);
    await sendPaymentReceipt('ana@example.com', receipt);

    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('ana@example.com');
    expect(mail.subject).toContain('₱ 1,500.00');
    expect(mail.subject).toContain('July 2026');
    expect(mail.text).toContain('Method: gcash');
    expect(mail.text).toContain('Payment type: Rental');
  });

  it('reuses one cached transport across sends', async () => {
    const { sendPaymentReceipt } = await loadMail(true);
    await sendPaymentReceipt('ana@example.com', receipt);
    await sendPaymentReceipt('ana@example.com', receipt);
    expect(createTransport).toHaveBeenCalledTimes(1);
  });

  it('falls back to the raw payment type for unknown types', async () => {
    const { sendPaymentReceipt } = await loadMail(true);
    await sendPaymentReceipt('ana@example.com', {
      ...receipt,
      paymentType: 'mystery',
      method: null,
    });
    const mail = sendMail.mock.calls[0][0];
    expect(mail.text).toContain('Payment type: mystery');
    expect(mail.text).not.toContain('Method:'); // null method omitted
  });
});

describe('sendPaymentReminder', () => {
  it('returns false when unconfigured', async () => {
    const { sendPaymentReminder } = await loadMail(false);
    expect(await sendPaymentReminder('ana@example.com', reminder)).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('returns true and includes the balance due and paid-so-far rows', async () => {
    const { sendPaymentReminder } = await loadMail(true);
    expect(await sendPaymentReminder('ana@example.com', reminder)).toBe(true);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toContain('₱ 600.00');
    expect(mail.text).toContain('Paid so far: ₱ 400.00');
    expect(mail.text).toContain('Balance due: ₱ 600.00');
  });

  it('omits the paid-so-far row when nothing has been paid', async () => {
    const { sendPaymentReminder } = await loadMail(true);
    await sendPaymentReminder('ana@example.com', { ...reminder, amountPaid: 0 });
    expect(sendMail.mock.calls[0][0].text).not.toContain('Paid so far');
  });
});

describe('sendTemporaryPassword', () => {
  it('returns false when unconfigured', async () => {
    const { sendTemporaryPassword } = await loadMail(false);
    expect(
      await sendTemporaryPassword('ana@example.com', {
        name: 'Ana',
        password: 'temp',
        isNewAccount: true,
      }),
    ).toBe(false);
  });

  it('uses new-account copy and includes the sign-in URL when set', async () => {
    const { sendTemporaryPassword } = await loadMail(true, {
      BETTER_AUTH_URL: 'https://8turf.vercel.app',
    });
    await sendTemporaryPassword('ana@example.com', {
      name: 'Ana',
      password: 'Temp1234',
      isNewAccount: true,
    });
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe('Your 8TURF Apartments account');
    expect(mail.text).toContain('Temporary password: Temp1234');
    expect(mail.text).toContain('https://8turf.vercel.app');
  });

  it('uses reset copy and generic instructions when no sign-in URL is set', async () => {
    const { sendTemporaryPassword } = await loadMail(true, { BETTER_AUTH_URL: '' });
    await sendTemporaryPassword('ana@example.com', {
      name: 'Ana',
      password: 'Temp1234',
      isNewAccount: false,
    });
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe('Your 8TURF Apartments password was reset');
    expect(mail.text).toContain('Please change your password after logging in.');
  });
});

describe('HTML escaping', () => {
  it('escapes angle brackets, ampersands, and quotes in interpolated values', async () => {
    const { sendPaymentReceipt } = await loadMail(true);
    await sendPaymentReceipt('ana@example.com', {
      ...receipt,
      tenantName: '<b>A&A</b> "x"',
    });
    const html = sendMail.mock.calls[0][0].html as string;
    expect(html).toContain('&lt;b&gt;A&amp;A&lt;/b&gt; &quot;x&quot;');
    expect(html).not.toContain('<b>A&A</b>');
  });
});
