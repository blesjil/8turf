import { describe, expect, it } from 'vitest';
import {
  anchorDueDate,
  chargeStatus,
  deriveCharges,
  type LeaseInput,
  type PaymentInput,
} from '@/lib/reports/charges';

describe('anchorDueDate', () => {
  it('uses the lease start day-of-month within the given period', () => {
    expect(anchorDueDate('2026-07-15', '2026-08')).toBe('2026-08-15');
    expect(anchorDueDate('2026-01-01', '2026-08')).toBe('2026-08-01');
  });

  it('clamps to the last day when the anchor day overflows a shorter month', () => {
    // 31st anchor in February clamps to Feb 28 (2026 is not a leap year).
    expect(anchorDueDate('2026-01-31', '2026-02')).toBe('2026-02-28');
    // 31st anchor in April (30 days) clamps to Apr 30.
    expect(anchorDueDate('2026-01-31', '2026-04')).toBe('2026-04-30');
  });

  it('handles a leap-year February', () => {
    expect(anchorDueDate('2024-01-30', '2024-02')).toBe('2024-02-29');
  });
});

describe('chargeStatus', () => {
  const base = { amount: 100000, dueDate: '2026-08-15', asOf: '2026-08-20' };

  it('is paid when credits cover the charge', () => {
    expect(chargeStatus({ ...base, creditsApplied: 100000 })).toBe('paid');
    expect(chargeStatus({ ...base, creditsApplied: 120000 })).toBe('paid');
  });

  it('is advance when fully paid before the due date', () => {
    expect(chargeStatus({ ...base, creditsApplied: 100000, latestPaidDate: '2026-08-10' })).toBe(
      'advance',
    );
  });

  it('is partial when some but not all is paid', () => {
    expect(chargeStatus({ ...base, creditsApplied: 40000 })).toBe('partial');
  });

  it('is not_due when nothing is paid and the due date is still in the future', () => {
    // as-of Aug 5, due Aug 15 -> not yet due (the mid-month false-unpaid fix)
    expect(chargeStatus({ ...base, asOf: '2026-08-05', creditsApplied: 0 })).toBe('not_due');
  });

  it('is unpaid when nothing is paid and it is due today', () => {
    expect(chargeStatus({ ...base, asOf: '2026-08-15', creditsApplied: 0 })).toBe('unpaid');
  });

  it('is overdue when nothing is paid past the due date', () => {
    expect(chargeStatus({ ...base, asOf: '2026-08-20', creditsApplied: 0 })).toBe('overdue');
  });

  it('treats a zero-rent charge as paid (never falsely unpaid)', () => {
    expect(chargeStatus({ ...base, amount: 0, creditsApplied: 0 })).toBe('paid');
  });
});

describe('deriveCharges', () => {
  function lease(overrides: Partial<LeaseInput> = {}): LeaseInput {
    return {
      propertyId: 'p1',
      propertyName: 'Property',
      unitId: 'u1',
      unitLabel: '101',
      tenantId: 't1',
      tenantName: 'Tenant',
      rentAmount: 100000,
      leaseStartDate: '2026-07-01',
      leaseEndDate: null,
      isActive: true,
      ...overrides,
    };
  }
  function payment(overrides: Partial<PaymentInput> = {}): PaymentInput {
    return {
      tenantId: 't1',
      amount: 100000,
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      payment_type: 'rental',
      paid_date: '2026-07-03',
      ...overrides,
    };
  }

  it('emits one charge per active period, skipping months outside the lease', () => {
    const charges = deriveCharges(
      [lease({ leaseStartDate: '2026-08-01' })],
      [],
      ['2026-07', '2026-08'],
      '2026-08-20',
    );
    expect(charges.map((c) => c.period)).toEqual(['2026-08']); // July is before the lease
  });

  it('applies credits from rent-covering payments and sets status', () => {
    const charges = deriveCharges([lease()], [payment()], ['2026-07'], '2026-07-31');
    expect(charges[0]).toMatchObject({
      period: '2026-07',
      dueDate: '2026-07-01',
      amount: 100000,
      creditsApplied: 100000,
      outstanding: 0,
      lastPaymentDate: '2026-07-03',
      status: 'paid',
    });
  });

  it('ignores deposits and reservations (non rent-covering)', () => {
    const charges = deriveCharges(
      [lease()],
      [payment({ payment_type: 'deposit' }), payment({ payment_type: 'reservation' })],
      ['2026-07'],
      '2026-07-31',
    );
    expect(charges[0].creditsApplied).toBe(0);
    expect(charges[0].outstanding).toBe(100000);
    expect(charges[0].status).toBe('overdue'); // due Jul 1, unpaid, as-of Jul 31
  });

  it('marks an unpaid charge not_due before its anchor day', () => {
    const charges = deriveCharges(
      [lease({ leaseStartDate: '2026-07-15' })],
      [],
      ['2026-07'],
      '2026-07-05',
    );
    expect(charges[0]).toMatchObject({ dueDate: '2026-07-15', status: 'not_due' });
  });

  it('collapses overlapping leases on one unit to a single occupant charge', () => {
    const outgoing = lease({
      tenantId: 'old',
      tenantName: 'Old',
      leaseStartDate: '2026-06-01',
      leaseEndDate: '2026-07-10',
      isActive: false,
    });
    const incoming = lease({
      tenantId: 'new',
      tenantName: 'New',
      leaseStartDate: '2026-07-15',
      isActive: true,
    });
    const charges = deriveCharges([outgoing, incoming], [], ['2026-07'], '2026-07-20');
    expect(charges).toHaveLength(1); // one unit → one charge, not two
    expect(charges[0].tenantId).toBe('new'); // active occupant wins
  });

  it('splits a multi-month payment across the periods it covers', () => {
    const charges = deriveCharges(
      [lease()],
      [payment({ amount: 200000, period_start: '2026-07-01', period_end: '2026-08-31' })],
      ['2026-07', '2026-08'],
      '2026-08-20',
    );
    expect(charges.map((c) => c.creditsApplied)).toEqual([100000, 100000]);
  });
});
