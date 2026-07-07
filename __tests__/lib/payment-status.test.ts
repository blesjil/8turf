import { describe, expect, it } from 'vitest';
import {
  computePaymentStatus,
  isLeaseActiveForPeriod,
  nextPeriodStart,
} from '@/lib/payment-status';

describe('nextPeriodStart', () => {
  it('falls back to lease start when there are no period-covering payments', () => {
    expect(nextPeriodStart([], '2026-07-07')).toBe('2026-07-07');
  });

  it('starts the day after the latest rental period end', () => {
    const payments = [
      { payment_type: 'rental', period_end: '2026-08-06' },
      { payment_type: 'rental', period_end: '2026-07-06' },
    ];
    expect(nextPeriodStart(payments, '2026-06-07')).toBe('2026-08-07');
  });

  it('counts advance payments as covering a rental period', () => {
    const payments = [
      { payment_type: 'deposit', period_end: '2026-07-07' },
      { payment_type: 'advance', period_end: '2026-08-06' },
    ];
    expect(nextPeriodStart(payments, '2026-07-07')).toBe('2026-08-07');
  });

  it('ignores deposits and reservations', () => {
    const payments = [
      { payment_type: 'deposit', period_end: '2026-09-01' },
      { payment_type: 'reservation', period_end: '2026-09-15' },
    ];
    expect(nextPeriodStart(payments, '2026-07-07')).toBe('2026-07-07');
  });

  it('returns undefined with no payments and no lease start', () => {
    expect(nextPeriodStart([], undefined)).toBeUndefined();
  });
});

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
