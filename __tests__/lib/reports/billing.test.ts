import { describe, expect, it } from 'vitest';
import type { Charge, ChargeStatus } from '@/lib/reports/charges';
import { summarizeBilling } from '@/lib/reports/billing';

function charge(status: ChargeStatus, amount: number, creditsApplied: number): Charge {
  return {
    propertyId: 'p1',
    propertyName: 'Property',
    unitId: 'u1',
    unitLabel: '101',
    tenantId: 't1',
    tenantName: 'Tenant',
    period: '2026-07',
    dueDate: '2026-07-01',
    amount,
    creditsApplied,
    outstanding: Math.max(0, amount - creditsApplied),
    lastPaymentDate: null,
    status,
  };
}

describe('summarizeBilling', () => {
  it('totals due/paid/outstanding and counts statuses', () => {
    const summary = summarizeBilling([
      charge('paid', 100000, 100000),
      charge('advance', 100000, 100000),
      charge('partial', 100000, 40000),
      charge('overdue', 100000, 0),
    ]);
    expect(summary).toEqual({
      totalBills: 4,
      totalDue: 400000,
      amountPaid: 240000,
      amountOutstanding: 160000,
      paidInAdvance: 1,
      partiallyPaid: 1,
      overdue: 1,
    });
  });

  it('caps amountPaid at the charge amount (ignores overpayment)', () => {
    const summary = summarizeBilling([charge('paid', 100000, 150000)]);
    expect(summary.amountPaid).toBe(100000);
    expect(summary.amountOutstanding).toBe(0);
  });
});
