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

// First name only, capped so the variable-length name can't push the fixed
// message skeleton past one GSM-7 segment. Shared by every SMS builder below.
const MAX_NAME_CHARS = 30;
function firstNameForSms(name: string): string {
  return name.trim().split(/\s+/)[0].slice(0, MAX_NAME_CHARS);
}

// Sends an already-built message over Semaphore and validates the response.
// Assumes the caller has confirmed the API key is set.
async function postSemaphoreMessage(phone: string, message: string): Promise<true> {
  const body = new URLSearchParams({
    apikey: semaphoreApiKey!,
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
  // for the name (see firstNameForSms) keeps the whole SMS inside one segment.
  const message =
    `Hi ${firstNameForSms(details.tenantName)}, gentle reminder: your ${formatPhp(details.amountDue)} rent ` +
    `for ${details.monthLabel} (Unit ${details.unitLabel}) is due ${formatShortDate(details.dueDate)}. ` +
    'Disregard if paid. -8TURF Apartments';

  return postSemaphoreMessage(phone, message);
}

export interface PaymentReceiptSmsDetails {
  tenantName: string;
  amount: number; // cents
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
}

// Manual, once-only "payment received" confirmation for a ledger entry.
// Same GSM-7 discipline as the reminder: "Php" not ₱, short dates, capped name.
// Returns false when Semaphore isn't configured so the caller can say so.
export async function sendSmsPaymentReceipt(
  phone: string,
  details: PaymentReceiptSmsDetails,
): Promise<boolean> {
  if (!semaphoreApiKey) {
    console.warn('SEMAPHORE_API_KEY not set — skipping payment receipt SMS');
    return false;
  }

  const message =
    `Hi ${firstNameForSms(details.tenantName)}, we received your ${formatPhp(details.amount)} payment ` +
    `for ${formatShortDate(details.periodStart)}-${formatShortDate(details.periodEnd)}. ` +
    'Thank you! -8TURF Apartments';

  return postSemaphoreMessage(phone, message);
}
