import { describe, expect, it } from 'vitest';
import {
  computePaymentStatus,
  countsTowardRent,
  coveredPeriods,
  creditForPeriod,
  creditsByPeriod,
  isLeaseActiveForPeriod,
  nextPeriodStart,
} from '@/lib/payment-status';

describe('countsTowardRent', () => {
  it('counts rental and advance payments toward monthly rent', () => {
    expect(countsTowardRent('rental')).toBe(true);
    expect(countsTowardRent('advance')).toBe(true);
  });

  it('excludes deposits and reservations from monthly rent', () => {
    expect(countsTowardRent('deposit')).toBe(false);
    expect(countsTowardRent('reservation')).toBe(false);
  });
});

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

describe('coveredPeriods', () => {
  it('treats a default one-month stay range as a single period', () => {
    // UI default: start + 30 days (Jul 7 – Aug 6 is one stay month)
    expect(coveredPeriods('2026-07-07', '2026-08-06')).toEqual(['2026-07']);
  });

  it('treats a full calendar month as a single period', () => {
    expect(coveredPeriods('2026-07-01', '2026-07-31')).toEqual(['2026-07']);
  });

  it('treats legacy migrated ranges (start + 30 days landing on the 1st) as a single period', () => {
    // Migration 0003 backfilled period_end = period-01 + 30 days
    expect(coveredPeriods('2026-06-01', '2026-07-01')).toEqual(['2026-06']);
  });

  it('treats legacy migrated February ranges (start + 30 days overshooting into March) as a single period', () => {
    // Feb 1 + 30 days = Mar 3 because February is short — still one month
    expect(coveredPeriods('2026-02-01', '2026-03-03')).toEqual(['2026-02']);
    expect(coveredPeriods('2027-02-01', '2027-03-03')).toEqual(['2027-02']);
  });

  it('counts a follow-on month once the range covers at least its first 15 days', () => {
    expect(coveredPeriods('2026-07-07', '2026-08-20')).toEqual(['2026-07']);
    expect(coveredPeriods('2026-07-07', '2026-08-21')).toEqual(['2026-07', '2026-08']);
  });

  it('splits a three-month stay range into three periods', () => {
    expect(coveredPeriods('2026-07-07', '2026-10-06')).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('splits three full calendar months into three periods', () => {
    expect(coveredPeriods('2026-07-01', '2026-09-30')).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('does not spill into an extra month when the range ends exactly on an anniversary', () => {
    // Jul 7 – Aug 7 is one stay month plus a single day; round down
    expect(coveredPeriods('2026-07-07', '2026-08-07')).toEqual(['2026-07']);
  });

  it('crosses year boundaries', () => {
    expect(coveredPeriods('2026-11-15', '2027-02-14')).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('handles a same-day range as a single period', () => {
    expect(coveredPeriods('2026-07-07', '2026-07-07')).toEqual(['2026-07']);
  });

  it('handles month-end anniversaries clamped by shorter months', () => {
    // addMonths clamps Jan 31 + 1 month to Feb 28
    expect(coveredPeriods('2026-01-31', '2026-03-30')).toEqual(['2026-01', '2026-02']);
  });
});

describe('creditsByPeriod', () => {
  it('credits a single-month payment entirely to its month', () => {
    const credits = creditsByPeriod({
      amount: 150000,
      period_start: '2026-07-07',
      period_end: '2026-08-06',
    });
    expect(credits).toEqual(new Map([['2026-07', 150000]]));
  });

  it('splits a multi-month payment evenly across covered months', () => {
    const credits = creditsByPeriod({
      amount: 300000,
      period_start: '2026-07-07',
      period_end: '2026-09-06',
    });
    expect(credits).toEqual(
      new Map([
        ['2026-07', 150000],
        ['2026-08', 150000],
      ]),
    );
  });

  it('assigns remainder cents to the earliest months and preserves the total', () => {
    const credits = creditsByPeriod({
      amount: 100,
      period_start: '2026-07-01',
      period_end: '2026-09-30',
    });
    expect(credits).toEqual(
      new Map([
        ['2026-07', 34],
        ['2026-08', 33],
        ['2026-09', 33],
      ]),
    );
    expect([...credits.values()].reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('creditForPeriod', () => {
  const threeMonthPayment = {
    amount: 450000,
    period_start: '2026-07-07',
    period_end: '2026-10-06',
  };

  it('returns the per-month share for a covered month', () => {
    expect(creditForPeriod(threeMonthPayment, '2026-07')).toBe(150000);
    expect(creditForPeriod(threeMonthPayment, '2026-08')).toBe(150000);
    expect(creditForPeriod(threeMonthPayment, '2026-09')).toBe(150000);
  });

  it('returns 0 for months outside the covered range', () => {
    expect(creditForPeriod(threeMonthPayment, '2026-06')).toBe(0);
    expect(creditForPeriod(threeMonthPayment, '2026-10')).toBe(0);
  });

  it('marks each covered month paid when the amount is n months of rent', () => {
    // The H1 scenario: 3 months of ₱1,500 rent paid in one advance payment
    for (const period of ['2026-07', '2026-08', '2026-09']) {
      const status = computePaymentStatus(creditForPeriod(threeMonthPayment, period), 150000);
      expect(status).toBe('paid');
    }
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
