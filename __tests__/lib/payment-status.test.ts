import { describe, expect, it } from 'vitest';
import { computePaymentStatus, isLeaseActiveForPeriod } from '@/lib/payment-status';

describe('computePaymentStatus', () => {
  it('returns unpaid when nothing has been paid', () => {
    expect(computePaymentStatus(0, 150000)).toBe('unpaid');
  });

  it('returns partial when paid amount is less than rent', () => {
    expect(computePaymentStatus(50000, 150000)).toBe('partial');
  });

  it('returns paid when paid amount equals rent', () => {
    expect(computePaymentStatus(150000, 150000)).toBe('paid');
  });

  it('returns paid when paid amount exceeds rent', () => {
    expect(computePaymentStatus(200000, 150000)).toBe('paid');
  });
});

describe('isLeaseActiveForPeriod', () => {
  it('is true for a period within an open-ended lease', () => {
    expect(isLeaseActiveForPeriod('2026-01-01', null, '2026-06')).toBe(true);
  });

  it('is false for a period before lease start', () => {
    expect(isLeaseActiveForPeriod('2026-03-01', null, '2026-02')).toBe(false);
  });

  it('is true for a period on the lease start month', () => {
    expect(isLeaseActiveForPeriod('2026-03-15', null, '2026-03')).toBe(true);
  });

  it('is true for a period on the lease end month', () => {
    expect(isLeaseActiveForPeriod('2026-01-01', '2026-06-15', '2026-06')).toBe(true);
  });

  it('is false for a period after lease end', () => {
    expect(isLeaseActiveForPeriod('2026-01-01', '2026-06-15', '2026-07')).toBe(false);
  });
});
