'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { format } from 'date-fns';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { query } from '@/lib/db';
import { sendPaymentReminder, type PaymentReminderDetails } from '@/lib/mail';
import { sendSmsPaymentReminder } from '@/lib/sms';
import { getPaymentsOverview, type OverviewRow } from '@/lib/payments-overview';
import { isReminderDue } from '@/lib/payments-summary';
import { formatPeriod } from '@/lib/format-date';

export interface ReminderResult {
  ok: boolean;
  error?: string;
}

export interface BulkReminderResult {
  ok: boolean;
  sent: number;
  skippedNoContact: number;
  failed: number;
  error?: string;
}

const NOT_CONFIGURED =
  'No reminder channel is configured (GMAIL_USER/GMAIL_APP_PASSWORD and SEMAPHORE_API_KEY missing).';

interface SendOutcome {
  /** At least one channel delivered the reminder. */
  sent: boolean;
  /** Every applicable channel was unconfigured (nothing was even attempted). */
  nothingConfigured: boolean;
  /** A configured channel threw while sending. */
  anyFailed: boolean;
}

// Sends the reminder over every channel the tenant has contact details for
// (email and/or SMS), then logs one payment_reminders row recording which
// channels actually succeeded.
async function sendReminder(row: OverviewRow, paid: number, period: string): Promise<SendOutcome> {
  const rentAmount = row.rentAmount ?? 0;
  const details: PaymentReminderDetails = {
    tenantName: row.tenantName!,
    propertyName: row.propertyName,
    unitLabel: row.unitLabel,
    monthLabel: formatPeriod(period),
    rentAmount,
    amountPaid: paid,
    amountDue: rentAmount - paid,
  };

  let emailSent = false;
  let smsSent = false;
  let attempted = 0;
  let anyFailed = false;

  if (row.tenantEmail) {
    try {
      emailSent = await sendPaymentReminder(row.tenantEmail, details);
      if (emailSent) attempted++;
    } catch (error) {
      console.error('Failed to send payment reminder email:', error);
      attempted++;
      anyFailed = true;
    }
  }
  if (row.tenantPhone) {
    try {
      smsSent = await sendSmsPaymentReminder(row.tenantPhone, details);
      if (smsSent) attempted++;
    } catch (error) {
      console.error('Failed to send payment reminder SMS:', error);
      attempted++;
      anyFailed = true;
    }
  }

  if (emailSent || smsSent) {
    const channel = emailSent && smsSent ? 'both' : emailSent ? 'email' : 'sms';
    const sentTo = [emailSent ? row.tenantEmail : null, smsSent ? row.tenantPhone : null]
      .filter(Boolean)
      .join(', ');
    await query(
      `INSERT INTO payment_reminders (id, tenant_id, period, sent_to, amount_due, channel)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), row.tenantId, period, sentTo, rentAmount - paid, channel],
    );
  }

  return { sent: emailSent || smsSent, nothingConfigured: attempted === 0, anyFailed };
}

export async function sendDueReminder(tenantId: string, period: string): Promise<ReminderResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  if (!/^\d{4}-\d{2}$/.test(period) || typeof tenantId !== 'string') {
    return { ok: false, error: 'Invalid request.' };
  }

  // Recompute status server-side from the same math as the overview table;
  // scoping happens inside the query, so a foreign tenantId simply won't match.
  const { activeRows, paidByTenant } = await getPaymentsOverview(period, ownerScope(session));
  const row = activeRows.find((r) => r.tenantId === tenantId);
  if (!row) {
    return { ok: false, error: 'Tenant not found or access denied.' };
  }
  if (!row.tenantEmail && !row.tenantPhone) {
    return { ok: false, error: 'This tenant has no email address or phone number on file.' };
  }
  const paid = paidByTenant.get(tenantId) ?? 0;
  const today = format(new Date(), 'yyyy-MM-dd');
  if (!isReminderDue(row, paidByTenant, period, today)) {
    return { ok: false, error: 'This tenant has no rent due for this month yet.' };
  }

  const outcome = await sendReminder(row, paid, period);
  if (!outcome.sent) {
    if (outcome.nothingConfigured) return { ok: false, error: NOT_CONFIGURED };
    return { ok: false, error: 'Failed to send the reminder. Please try again.' };
  }

  revalidatePath('/payments');
  return { ok: true };
}

export async function sendAllDueReminders(period: string): Promise<BulkReminderResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return { ok: false, sent: 0, skippedNoContact: 0, failed: 0, error: 'Invalid request.' };
  }

  const { activeRows, paidByTenant } = await getPaymentsOverview(period, ownerScope(session));
  const today = format(new Date(), 'yyyy-MM-dd');
  const unpaid = activeRows.filter((r) => isReminderDue(r, paidByTenant, period, today));

  let sent = 0;
  let skippedNoContact = 0;
  let failed = 0;
  for (const row of unpaid) {
    if (!row.tenantEmail && !row.tenantPhone) {
      skippedNoContact++;
      continue;
    }
    const outcome = await sendReminder(row, paidByTenant.get(row.tenantId!) ?? 0, period);
    if (outcome.sent) {
      sent++;
    } else if (outcome.nothingConfigured) {
      return { ok: false, sent, skippedNoContact, failed, error: NOT_CONFIGURED };
    } else {
      failed++;
    }
  }

  if (sent > 0) revalidatePath('/payments');
  return { ok: failed === 0, sent, skippedNoContact, failed };
}
