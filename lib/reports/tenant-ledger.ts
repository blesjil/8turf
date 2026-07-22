import { query } from '@/lib/db';
import type { Charge } from '@/lib/reports/charges';

// A payment as it appears in a tenant's ledger (all types count as credits).
export interface LedgerPayment {
  paymentId: string;
  paidDate: string;
  amount: number;
  method: string | null;
  paymentType: string;
  periodStart: string;
  periodEnd: string;
}

export interface LedgerEntry {
  date: string;
  type: 'charge' | 'payment';
  description: string;
  reference: string | null;
  coverage: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

// Interleave rent charges (debits, dated on their due date) with payments
// (credits, dated on payment date) into one chronological ledger with a running
// balance. Positive balance = tenant owes; negative = tenant holds credit.
// Same-day ties put the charge before the payment (rent is owed, then paid).
export function buildLedger(charges: Charge[], payments: LedgerPayment[]): LedgerEntry[] {
  const debits = charges.map((c) => ({
    date: c.dueDate,
    type: 'charge' as const,
    description: 'Rent charge',
    reference: null,
    coverage: c.period,
    debit: c.amount,
    credit: 0,
  }));
  const credits = payments.map((p) => ({
    date: p.paidDate,
    type: 'payment' as const,
    description: `Payment (${p.paymentType})`,
    reference: p.paymentId,
    coverage: `${p.periodStart} – ${p.periodEnd}`,
    debit: 0,
    credit: p.amount,
  }));

  const ordered = [...debits, ...credits].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.type !== b.type) return a.type === 'charge' ? -1 : 1;
    return 0;
  });

  let runningBalance = 0;
  return ordered.map((e) => {
    runningBalance += e.debit - e.credit;
    return { ...e, runningBalance };
  });
}

export function fetchLedgerPayments(
  tenantId: string,
  scope: string | null,
): Promise<LedgerPayment[]> {
  return query<LedgerPayment>(
    `SELECT rp.id as "paymentId", rp.paid_date as "paidDate", rp.amount,
            rp.method, rp.payment_type as "paymentType",
            rp.period_start as "periodStart", rp.period_end as "periodEnd"
     FROM rent_payments rp
     JOIN units u ON u.id = rp.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE rp.tenant_id = $1
       AND ($2::text IS NULL OR p.user_id = $2)
       AND p.archived_at IS NULL AND u.archived_at IS NULL`,
    [tenantId, scope],
  );
}
