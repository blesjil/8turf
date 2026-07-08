'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { query } from '@/lib/db';
import { sendPaymentReminder } from '@/lib/mail';
import { getPaymentsOverview, type OverviewRow } from '@/lib/payments-overview';
import { formatPeriod } from '@/lib/format-date';

export interface ReminderResult {
  ok: boolean;
  error?: string;
}

export interface BulkReminderResult {
  ok: boolean;
  sent: number;
  skippedNoEmail: number;
  failed: number;
  error?: string;
}

const NOT_CONFIGURED = 'Email is not configured (GMAIL_USER/GMAIL_APP_PASSWORD missing).';

async function emailReminder(row: OverviewRow, paid: number, period: string): Promise<boolean> {
  const rentAmount = row.rentAmount ?? 0;
  const configured = await sendPaymentReminder(row.tenantEmail!, {
    tenantName: row.tenantName!,
    propertyName: row.propertyName,
    unitLabel: row.unitLabel,
    monthLabel: formatPeriod(period),
    rentAmount,
    amountPaid: paid,
    amountDue: rentAmount - paid,
  });
  if (configured) {
    await query(
      `INSERT INTO payment_reminders (id, tenant_id, period, sent_to, amount_due)
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), row.tenantId, period, row.tenantEmail, rentAmount - paid],
    );
  }
  return configured;
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
  if (!row.tenantEmail) {
    return { ok: false, error: 'This tenant has no email address on file.' };
  }
  const paid = paidByTenant.get(tenantId) ?? 0;
  if (paid >= (row.rentAmount ?? 0)) {
    return { ok: false, error: 'This tenant has no outstanding balance for this month.' };
  }

  try {
    const configured = await emailReminder(row, paid, period);
    if (!configured) return { ok: false, error: NOT_CONFIGURED };
  } catch (error) {
    console.error('Failed to send payment reminder email:', error);
    return { ok: false, error: 'Failed to send the reminder email. Please try again.' };
  }

  revalidatePath('/payments');
  return { ok: true };
}

export async function sendAllDueReminders(period: string): Promise<BulkReminderResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return { ok: false, sent: 0, skippedNoEmail: 0, failed: 0, error: 'Invalid request.' };
  }

  const { activeRows, paidByTenant } = await getPaymentsOverview(period, ownerScope(session));
  const unpaid = activeRows.filter(
    (r) => (paidByTenant.get(r.tenantId!) ?? 0) < (r.rentAmount ?? 0),
  );

  let sent = 0;
  let skippedNoEmail = 0;
  let failed = 0;
  for (const row of unpaid) {
    if (!row.tenantEmail) {
      skippedNoEmail++;
      continue;
    }
    try {
      const configured = await emailReminder(row, paidByTenant.get(row.tenantId!) ?? 0, period);
      if (!configured) {
        return { ok: false, sent, skippedNoEmail, failed, error: NOT_CONFIGURED };
      }
      sent++;
    } catch (error) {
      console.error('Failed to send payment reminder email:', error);
      failed++;
    }
  }

  if (sent > 0) revalidatePath('/payments');
  return { ok: failed === 0, sent, skippedNoEmail, failed };
}
