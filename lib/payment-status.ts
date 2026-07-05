export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export function computePaymentStatus(totalPaid: number, rentAmount: number): PaymentStatus {
  if (totalPaid <= 0) return 'unpaid';
  if (totalPaid < rentAmount) return 'partial';
  return 'paid';
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
