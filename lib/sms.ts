import type { PaymentReminderDetails } from '@/lib/mail';
import { MONTH_NAMES } from '@/lib/format-date';

const semaphoreApiKey = process.env.SEMAPHORE_API_KEY;
const semaphoreSenderName = process.env.SEMAPHORE_SENDER_NAME;

const SEMAPHORE_MESSAGES_URL = 'https://api.semaphore.co/api/v4/messages';

export function isSmsConfigured(): boolean {
  return Boolean(semaphoreApiKey);
}

// Semaphore accepts 09XXXXXXXXX or 639XXXXXXXXX; normalize the formats our
// tenant validation allows (09..., +639..., with spaces/dashes) to 09...
function normalizePhilippinePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+639')) return `0${cleaned.slice(3)}`;
  if (cleaned.startsWith('639')) return `0${cleaned.slice(2)}`;
  return cleaned;
}

// The peso sign is outside the GSM-7 charset and would force 70-char UCS-2
// segments, so SMS bodies spell out "Php" instead. Decimals are dropped for
// whole amounts (the common case) to keep the message within one segment.
function formatPhp(cents: number): string {
  const amount = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `Php ${amount}`;
}

// Compact due date for SMS, e.g. "Jul 5" — no year, to save characters.
function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

// Error messages below embed raw Semaphore response text and end up in server
// logs; strip the API key in case the API ever echoes submitted params back.
function redactApiKey(text: string): string {
  return semaphoreApiKey ? text.replaceAll(semaphoreApiKey, '[redacted]') : text;
}

interface SemaphoreMessage {
  message_id?: number;
  recipient?: string;
  status?: string;
}

// Returns false when Semaphore isn't configured, so callers can surface
// "SMS not configured" instead of claiming the reminder was sent.
export async function sendSmsPaymentReminder(
  phone: string,
  details: PaymentReminderDetails,
): Promise<boolean> {
  if (!semaphoreApiKey) {
    console.warn('SEMAPHORE_API_KEY not set — skipping payment reminder SMS');
    return false;
  }

  // The rest of the message fits well within 130 GSM-7 chars, so reserving 30
  // for the name guarantees the whole SMS stays inside one 160-char segment.
  // First name only + no property name; the cap defends against unusually long
  // first names.
  const MAX_NAME_CHARS = 30;
  const firstName = details.tenantName.trim().split(/\s+/)[0].slice(0, MAX_NAME_CHARS);
  const message =
    `Hi ${firstName}, gentle reminder: your ${formatPhp(details.amountDue)} rent ` +
    `for ${details.monthLabel} (Unit ${details.unitLabel}) is due ${formatShortDate(details.dueDate)}. ` +
    'Disregard if paid. -8TURF Apartments';

  const body = new URLSearchParams({
    apikey: semaphoreApiKey,
    number: normalizePhilippinePhone(phone),
    message,
  });
  // Sender names must be pre-approved by Semaphore; omit to use the account default.
  if (semaphoreSenderName) body.set('sendername', semaphoreSenderName);

  const res = await fetch(SEMAPHORE_MESSAGES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `Semaphore send failed (HTTP ${res.status}): ${redactApiKey(await res.text())}`,
    );
  }

  // Success responses are an array of queued message objects; anything else
  // (e.g. a validation-error object) means the message was not accepted.
  const data: unknown = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Semaphore rejected the message: ${redactApiKey(JSON.stringify(data))}`);
  }
  const failed = (data as SemaphoreMessage[]).find(
    (m) => m.status === 'Failed' || m.status === 'Refunded',
  );
  if (failed) {
    throw new Error(`Semaphore reported status ${failed.status} for ${failed.recipient}`);
  }
  return true;
}
