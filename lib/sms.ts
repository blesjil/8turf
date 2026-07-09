import type { PaymentReminderDetails } from '@/lib/mail';
import { formatCents } from '@/lib/money';

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
// segments, so SMS bodies spell out "Php" instead of using formatCents.
function formatPhp(cents: number): string {
  return `Php ${formatCents(cents).replace(/^\D+/, '')}`;
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

  const message = [
    `Hi ${details.tenantName}, friendly reminder: your rent for ${details.monthLabel}`,
    `at ${details.propertyName} Unit ${details.unitLabel} has a balance of ${formatPhp(details.amountDue)}.`,
    'Kindly disregard if already settled. - 8Turf Apartments',
  ].join(' ');

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
