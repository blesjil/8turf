import { describe, expect, it } from 'vitest';
import type { Charge } from '@/lib/reports/charges';
import { buildLedger, type LedgerPayment } from '@/lib/reports/tenant-ledger';

function charge(period: string, dueDate: string, amount: number): Charge {
  return {
    propertyId: 'p1',
    propertyName: 'Property',
    unitId: 'u1',
    unitLabel: '101',
    tenantId: 't1',
    tenantName: 'Tenant',
    period,
    dueDate,
    amount,
    creditsApplied: 0,
    outstanding: amount,
    lastPaymentDate: null,
    status: 'unpaid',
  };
}

function payment(paidDate: string, amount: number): LedgerPayment {
  return {
    paymentId: `pay-${paidDate}`,
    paidDate,
    amount,
    method: 'cash',
    paymentType: 'rental',
    periodStart: paidDate,
    periodEnd: paidDate,
  };
}

describe('buildLedger', () => {
  it('interleaves charges and payments chronologically with a running balance', () => {
    const ledger = buildLedger(
      [charge('2026-07', '2026-07-01', 100000), charge('2026-08', '2026-08-01', 100000)],
      [payment('2026-07-05', 100000), payment('2026-08-03', 60000)],
    );
    expect(ledger.map((e) => [e.date, e.type, e.runningBalance])).toEqual([
      ['2026-07-01', 'charge', 100000],
      ['2026-07-05', 'payment', 0],
      ['2026-08-01', 'charge', 100000],
      ['2026-08-03', 'payment', 40000],
    ]);
  });

  it('orders a charge before a payment on the same day', () => {
    const ledger = buildLedger(
      [charge('2026-07', '2026-07-01', 100000)],
      [payment('2026-07-01', 100000)],
    );
    expect(ledger.map((e) => e.type)).toEqual(['charge', 'payment']);
    expect(ledger.at(-1)!.runningBalance).toBe(0);
  });

  it('shows a negative running balance as tenant credit', () => {
    const ledger = buildLedger([], [payment('2026-07-01', 50000)]);
    expect(ledger[0].runningBalance).toBe(-50000);
  });
});
