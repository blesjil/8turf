import { describe, expect, it } from 'vitest';
import {
  classifyPayment,
  summarizeCollections,
  type CollectionRow,
} from '@/lib/reports/collections';

describe('classifyPayment', () => {
  const base = { periodStart: '2026-07-01', periodEnd: '2026-07-31', paymentType: 'rental' };

  it('is advance when paid before the coverage starts', () => {
    expect(classifyPayment({ ...base, paidDate: '2026-06-20' })).toBe('advance');
  });

  it('is advance when flagged as an advance payment type', () => {
    expect(classifyPayment({ ...base, paidDate: '2026-07-10', paymentType: 'advance' })).toBe(
      'advance',
    );
  });

  it('is late when paid after the coverage ends', () => {
    expect(classifyPayment({ ...base, paidDate: '2026-08-05' })).toBe('late');
  });

  it('is on_time when paid within the coverage period', () => {
    expect(classifyPayment({ ...base, paidDate: '2026-07-03' })).toBe('on_time');
  });
});

describe('summarizeCollections', () => {
  function payment(overrides: Partial<CollectionRow> = {}): CollectionRow {
    return {
      paymentId: 'r1',
      paidDate: '2026-07-03',
      tenantId: 't1',
      tenantName: 'Tenant',
      propertyId: 'p1',
      unitId: 'u1',
      unitLabel: '101',
      amount: 100000,
      method: 'cash',
      paymentType: 'rental',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      ...overrides,
    };
  }

  it('totals amount, counts advance/late, and groups by method', () => {
    const rows = [
      payment({ amount: 100000, method: 'cash' }),
      payment({ amount: 50000, method: 'gcash', paidDate: '2026-06-20' }), // advance
      payment({ amount: 30000, method: 'cash', paidDate: '2026-08-10' }), // late
    ];
    const summary = summarizeCollections(rows);
    expect(summary.totalPayments).toBe(3);
    expect(summary.totalCollected).toBe(180000);
    expect(summary.advance).toBe(1);
    expect(summary.late).toBe(1);
    expect(summary.byMethod).toEqual([
      { method: 'cash', amount: 130000 },
      { method: 'gcash', amount: 50000 },
    ]);
  });

  it('labels blank methods as Unspecified', () => {
    expect(summarizeCollections([payment({ method: null })]).byMethod).toEqual([
      { method: 'Unspecified', amount: 100000 },
    ]);
  });
});
