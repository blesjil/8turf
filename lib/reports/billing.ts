import { isPastGracePeriod, type Charge } from '@/lib/reports/charges';

export interface BillingSummary {
  totalBills: number;
  totalDue: number;
  amountPaid: number;
  amountOutstanding: number;
  paidInAdvance: number;
  partiallyPaid: number;
  overdue: number;
}

// Totals for the Billing report — grouped by due date, so a charge counts in
// its own due month even if it was paid earlier. A bill is overdue when any
// balance remains past its due date plus the grace period (partially paid
// included), evaluated at `asOf`, so the count can't hide a half-paid late
// account.
export function summarizeBilling(charges: Charge[], asOf: string): BillingSummary {
  const summary: BillingSummary = {
    totalBills: charges.length,
    totalDue: 0,
    amountPaid: 0,
    amountOutstanding: 0,
    paidInAdvance: 0,
    partiallyPaid: 0,
    overdue: 0,
  };
  for (const c of charges) {
    summary.totalDue += c.amount;
    summary.amountPaid += Math.min(c.creditsApplied, c.amount);
    summary.amountOutstanding += c.outstanding;
    if (c.status === 'advance') summary.paidInAdvance += 1;
    else if (c.status === 'partial') summary.partiallyPaid += 1;
    if (c.outstanding > 0 && isPastGracePeriod(c.dueDate, asOf)) summary.overdue += 1;
  }
  return summary;
}
