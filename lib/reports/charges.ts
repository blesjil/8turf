import { getDaysInMonth, parseISO } from 'date-fns';

// Shared "rent due" primitives for the reports and the Payments Overview.
//
// The app has no bill/due-date entity — rent owed is derived from the lease and
// the payment ledger. These helpers give every covered month a single, correct
// due date (the lease-anniversary day) and a status that distinguishes "not yet
// due" from genuinely unpaid, so a tenant on a non-1st cycle isn't shown as
// delinquent before their anniversary day arrives.

// A charge covering `period` (YYYY-MM) is due on the lease's day-of-month,
// clamped to the month's length so a 31st anchor lands on Feb 28/29, Apr 30, etc.
export function anchorDueDate(leaseStartDate: string, period: string): string {
  const anchorDay = Number(leaseStartDate.slice(8, 10));
  const lastDay = getDaysInMonth(parseISO(`${period}-01`));
  const day = Math.min(anchorDay, lastDay);
  return `${period}-${String(day).padStart(2, '0')}`;
}

export type ChargeStatus = 'paid' | 'advance' | 'partial' | 'not_due' | 'unpaid' | 'overdue';

// The status of one derived monthly charge, evaluated at `asOf`:
//   paid     — fully covered
//   advance  — fully covered by a payment made before the due date
//   partial  — some, but not all, covered
//   not_due  — nothing paid and the due date is still in the future (the
//              mid-month false-"unpaid" fix — no reminder, not outstanding)
//   unpaid   — nothing paid and due today
//   overdue  — nothing paid past the due date
export function chargeStatus(opts: {
  amount: number;
  creditsApplied: number;
  dueDate: string;
  asOf: string;
  latestPaidDate?: string | null;
}): ChargeStatus {
  const { amount, creditsApplied, dueDate, asOf, latestPaidDate } = opts;
  if (creditsApplied >= amount) {
    return latestPaidDate && latestPaidDate < dueDate ? 'advance' : 'paid';
  }
  if (creditsApplied > 0) return 'partial';
  if (asOf < dueDate) return 'not_due';
  if (asOf > dueDate) return 'overdue';
  return 'unpaid';
}
