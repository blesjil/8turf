import { addDays, format, parseISO } from 'date-fns';

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
