import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentReminderDetails } from '@/lib/mail';

// sms.ts captures env vars at module load, so each configuration is exercised
// by resetting modules and re-importing with the desired env in place.
const details: PaymentReminderDetails = {
  tenantName: 'Ana',
  propertyName: 'Sunrise',
  unitLabel: '2B',
  monthLabel: 'July 2026',
  rentAmount: 100000,
  amountPaid: 0,
  amountDue: 100000,
};

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

async function loadSms(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.stubEnv('SEMAPHORE_API_KEY', env.SEMAPHORE_API_KEY ?? '');
  vi.stubEnv('SEMAPHORE_SENDER_NAME', env.SEMAPHORE_SENDER_NAME ?? '');
  return import('@/lib/sms');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isSmsConfigured', () => {
  it('is false without an API key and true with one', async () => {
    expect((await loadSms({})).isSmsConfigured()).toBe(false);
    expect((await loadSms({ SEMAPHORE_API_KEY: 'k' })).isSmsConfigured()).toBe(true);
  });
});

describe('sendSmsPaymentReminder (unconfigured)', () => {
  it('returns false and does not call the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendSmsPaymentReminder } = await loadSms({});

    expect(await sendSmsPaymentReminder('09171234567', details)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sendSmsPaymentReminder (configured)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(okResponse([{ message_id: 1, status: 'Pending' }]));
    vi.stubGlobal('fetch', fetchMock);
  });

  function sentBody(): URLSearchParams {
    return fetchMock.mock.calls[0][1].body as URLSearchParams;
  }

  it('returns true and posts to the Semaphore endpoint', async () => {
    const { sendSmsPaymentReminder } = await loadSms({ SEMAPHORE_API_KEY: 'k' });
    expect(await sendSmsPaymentReminder('09171234567', details)).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.semaphore.co/api/v4/messages');
  });

  it.each([
    ['09171234567', '09171234567'],
    ['+639171234567', '09171234567'],
    ['639171234567', '09171234567'],
    ['0917-123-4567', '09171234567'],
    ['+63 917 123 4567', '09171234567'],
  ])('normalizes %s to %s', async (input, expected) => {
    const { sendSmsPaymentReminder } = await loadSms({ SEMAPHORE_API_KEY: 'k' });
    await sendSmsPaymentReminder(input, details);
    expect(sentBody().get('number')).toBe(expected);
  });

  it('spells out the peso amount as "Php" (GSM-7 safe) in the body', async () => {
    const { sendSmsPaymentReminder } = await loadSms({ SEMAPHORE_API_KEY: 'k' });
    await sendSmsPaymentReminder('09171234567', details);
    const message = sentBody().get('message')!;
    expect(message).toContain('Php 1,000.00');
    expect(message).not.toContain('₱');
  });

  it('includes the sender name only when configured', async () => {
    let sms = await loadSms({ SEMAPHORE_API_KEY: 'k' });
    await sms.sendSmsPaymentReminder('09171234567', details);
    expect(sentBody().has('sendername')).toBe(false);

    fetchMock.mockClear();
    sms = await loadSms({ SEMAPHORE_API_KEY: 'k', SEMAPHORE_SENDER_NAME: '8TURF' });
    await sms.sendSmsPaymentReminder('09171234567', details);
    expect(sentBody().get('sendername')).toBe('8TURF');
  });

  it('throws and redacts the API key on an HTTP error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid apikey=supersecret in request',
    } as Response);
    const { sendSmsPaymentReminder } = await loadSms({ SEMAPHORE_API_KEY: 'supersecret' });

    await expect(sendSmsPaymentReminder('09171234567', details)).rejects.toThrow(/HTTP 401/);
    await expect(sendSmsPaymentReminder('09171234567', details)).rejects.not.toThrow(/supersecret/);
  });

  it('throws when Semaphore returns a non-array (validation error) body', async () => {
    fetchMock.mockResolvedValue(okResponse({ error: 'bad number' }));
    const { sendSmsPaymentReminder } = await loadSms({ SEMAPHORE_API_KEY: 'k' });
    await expect(sendSmsPaymentReminder('09171234567', details)).rejects.toThrow(/rejected/);
  });

  it('throws when a queued message reports a Failed status', async () => {
    fetchMock.mockResolvedValue(okResponse([{ recipient: '09171234567', status: 'Failed' }]));
    const { sendSmsPaymentReminder } = await loadSms({ SEMAPHORE_API_KEY: 'k' });
    await expect(sendSmsPaymentReminder('09171234567', details)).rejects.toThrow(/Failed/);
  });
});
