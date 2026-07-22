import { describe, expect, it } from 'vitest';
import type { Charge } from '@/lib/reports/charges';
import { buildOutstanding, daysOverdue, summarizeOutstanding } from '@/lib/reports/outstanding';

function charge(overrides: Partial<Charge> = {}): Charge {
  return {
    propertyId: 'p1',
    propertyName: 'Property',
    unitId: 'u1',
    unitLabel: '101',
    tenantId: 't1',
    tenantName: 'Tenant',
    period: '2026-07',
    dueDate: '2026-07-01',
    amount: 100000,
    creditsApplied: 0,
    outstanding: 100000,
    lastPaymentDate: null,
    status: 'overdue',
    ...overrides,
  };
}

describe('daysOverdue', () => {
  it('counts whole days past the due date', () => {
    expect(daysOverdue('2026-07-01', '2026-07-31')).toBe(30);
  });

  it('is 0 when not yet due', () => {
    expect(daysOverdue('2026-07-15', '2026-07-05')).toBe(0);
  });
});

describe('buildOutstanding', () => {
  it('keeps only charges with a balance, sorted by days overdue desc', () => {
    const rows = buildOutstanding(
      [
        charge({ dueDate: '2026-07-01', outstanding: 100000 }), // 30 days
        charge({ outstanding: 0 }), // paid → dropped
        charge({ dueDate: '2026-07-20', outstanding: 40000 }), // 11 days
      ],
      '2026-07-31',
    );
    expect(rows.map((r) => r.daysOverdue)).toEqual([30, 11]);
  });
});

describe('summarizeOutstanding', () => {
  it('keeps a balance within the grace period in the current bucket', () => {
    // Due Aug 3, as-of Aug 5 → 2 days past due, last day of the 2-day grace period.
    const rows = buildOutstanding(
      [charge({ dueDate: '2026-08-03', outstanding: 50000 })],
      '2026-08-05',
    );
    const summary = summarizeOutstanding(rows);
    expect(summary.currentOutstanding).toBe(50000);
    expect(summary.overdueOutstanding).toBe(0);
  });

  it('splits current vs overdue and counts distinct tenants', () => {
    const rows = buildOutstanding(
      [
        charge({ tenantId: 't1', dueDate: '2026-07-01', outstanding: 100000 }), // overdue
        charge({ tenantId: 't1', dueDate: '2026-08-15', outstanding: 50000 }), // current
        charge({ tenantId: 't2', dueDate: '2026-07-10', outstanding: 20000 }), // overdue
      ],
      '2026-08-05',
    );
    const summary = summarizeOutstanding(rows);
    expect(summary.totalOutstanding).toBe(170000);
    expect(summary.tenantsWithBalance).toBe(2);
    expect(summary.overdueOutstanding).toBe(120000);
    expect(summary.currentOutstanding).toBe(50000);
  });
});
