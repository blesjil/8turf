import { addDays, addMonths, format, parseISO } from 'date-fns';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

// Deposits and reservations are money held, not rent for a period — only
// rental and advance payments count toward a month's paid/partial/unpaid math.
export const RENT_COVERING_PAYMENT_TYPES = ['rental', 'advance'] as const;

export function countsTowardRent(paymentType: string): boolean {
  return (RENT_COVERING_PAYMENT_TYPES as readonly string[]).includes(paymentType);
}

export function computePaymentStatus(totalPaid: number, rentAmount: number): PaymentStatus {
  if (totalPaid <= 0) return 'unpaid';
  if (totalPaid < rentAmount) return 'partial';
  return 'paid';
}

export function nextPeriodStart(
  payments: { payment_type: string; period_end: string }[],
  leaseStartDate?: string,
): string | undefined {
  // Deposits and reservations don't cover a rental period, so they don't move the next start.
  const lastCoveredEnd = payments
    .filter((p) => countsTowardRent(p.payment_type))
    .reduce<string | null>((max, p) => (!max || p.period_end > max ? p.period_end : max), null);
  if (!lastCoveredEnd) return leaseStartDate;
  return format(addDays(parseISO(lastCoveredEnd), 1), 'yyyy-MM-dd');
}

// The YYYY-MM "stay months" a payment range covers, anchored at the range's
// start day: Jul 7 – Aug 6 is one month labeled 2026-07, Jul 7 – Oct 6 is
// three (2026-07..09). A follow-on month k only counts once the range reaches
// that month's midpoint (start + k months + 14 days), so a few days of
// overshoot — like migration-0003 rows backfilled as start + 30 days, which
// land on the 1st of the next month (or Mar 3 when starting in February) —
// doesn't spill into an extra month.
export function coveredPeriods(periodStart: string, periodEnd: string): string[] {
  const start = parseISO(periodStart);
  const periods = [format(start, 'yyyy-MM')];
  for (let k = 1; ; k++) {
    const anniversary = addMonths(start, k);
    if (format(addDays(anniversary, 14), 'yyyy-MM-dd') > periodEnd) break;
    periods.push(format(anniversary, 'yyyy-MM'));
  }
  return periods;
}

// A payment's amount split evenly across the stay months it covers, in integer
// cents with any remainder cents going to the earliest months so the shares
// always sum back to the original amount.
export function creditsByPeriod(payment: {
  amount: number;
  period_start: string;
  period_end: string;
}): Map<string, number> {
  const periods = coveredPeriods(payment.period_start, payment.period_end);
  const base = Math.floor(payment.amount / periods.length);
  const remainder = payment.amount - base * periods.length;
  return new Map(periods.map((period, i) => [period, base + (i < remainder ? 1 : 0)]));
}

export function creditForPeriod(
  payment: { amount: number; period_start: string; period_end: string },
  period: string,
): number {
  return creditsByPeriod(payment).get(period) ?? 0;
}

export function isLeaseActiveForPeriod(
  leaseStartDate: string,
  leaseEndDate: string | null,
  period: string,
): boolean {
  const startPeriod = leaseStartDate.slice(0, 7);
  if (period < startPeriod) return false;
  if (leaseEndDate) {
    const endPeriod = leaseEndDate.slice(0, 7);
    if (period > endPeriod) return false;
  }
  return true;
}
