import { describe, expect, it } from 'vitest';
import type { OverviewRow } from '@/lib/payments-overview';
import {
  filterRowsByStatus,
  parseStatusFilter,
  rowStatus,
  summarizePayments,
} from '@/lib/payments-summary';

// Minimal OverviewRow factory; only the fields the summary helpers read matter.
function row(overrides: Partial<OverviewRow> = {}): OverviewRow {
  return {
    propertyId: 'p1',
    propertyName: 'Property',
    unitId: 'u1',
    unitLabel: '101',
    tenantId: 't1',
    tenantName: 'Tenant',
    tenantEmail: null,
    tenantPhone: null,
    isActive: true,
    rentAmount: 100000,
    leaseStartDate: '2026-01-01',
    leaseEndDate: null,
    ...overrides,
  };
}

const paid = new Map<string, number>([
  ['paidTenant', 100000],
  ['partialTenant', 40000],
  ['overpaidTenant', 150000],
  // unpaidTenant absent → 0
]);

describe('rowStatus', () => {
  it('returns inactive for vacant rows (no tenant)', () => {
    expect(rowStatus(row({ tenantId: null, rentAmount: null }), paid)).toBe('inactive');
  });

  it('returns paid when paid covers rent', () => {
    expect(rowStatus(row({ tenantId: 'paidTenant' }), paid)).toBe('paid');
  });

  it('returns partial when some but not all rent is paid', () => {
    expect(rowStatus(row({ tenantId: 'partialTenant' }), paid)).toBe('partial');
  });

  it('returns unpaid when nothing is paid', () => {
    expect(rowStatus(row({ tenantId: 'unpaidTenant' }), paid)).toBe('unpaid');
  });
});

describe('filterRowsByStatus', () => {
  const rows = [
    row({ tenantId: 'paidTenant' }),
    row({ tenantId: 'partialTenant' }),
    row({ tenantId: 'unpaidTenant' }),
    row({ tenantId: null, rentAmount: null }),
  ];

  it('passes every row through when filter is all', () => {
    expect(filterRowsByStatus(rows, paid, 'all')).toHaveLength(4);
  });

  it('narrows to a single status', () => {
    expect(filterRowsByStatus(rows, paid, 'paid').map((r) => r.tenantId)).toEqual(['paidTenant']);
    expect(filterRowsByStatus(rows, paid, 'partial').map((r) => r.tenantId)).toEqual([
      'partialTenant',
    ]);
    expect(filterRowsByStatus(rows, paid, 'unpaid').map((r) => r.tenantId)).toEqual([
      'unpaidTenant',
    ]);
  });

  it('inactive filter keeps only vacant rows', () => {
    const result = filterRowsByStatus(rows, paid, 'inactive');
    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBeNull();
  });
});

describe('summarizePayments', () => {
  it('counts leases, unpaid leases, and vacant units', () => {
    const active = [
      row({ tenantId: 'paidTenant' }),
      row({ tenantId: 'partialTenant' }),
      row({ tenantId: 'unpaidTenant' }),
    ];
    const inactive = [
      row({ tenantId: null, rentAmount: null }),
      row({ tenantId: null, rentAmount: null }),
    ];
    const summary = summarizePayments(active, inactive, paid);

    expect(summary.activeLeases).toBe(3);
    expect(summary.unpaidLeases).toBe(2); // partial + unpaid
    expect(summary.vacantUnits).toBe(2);
  });

  it('caps collected at rent (ignores overpayment) and floors outstanding at 0', () => {
    const active = [
      row({ tenantId: 'overpaidTenant', rentAmount: 100000 }), // paid 150000, capped to 100000
      row({ tenantId: 'partialTenant', rentAmount: 100000 }), // paid 40000
    ];
    const summary = summarizePayments(active, [], paid);

    expect(summary.totalCollected).toBe(140000); // 100000 capped + 40000
    expect(summary.outstanding).toBe(60000); // due 200000 - collected 140000
  });

  it('returns zeros for an empty month', () => {
    expect(summarizePayments([], [], paid)).toEqual({
      activeLeases: 0,
      unpaidLeases: 0,
      vacantUnits: 0,
      totalCollected: 0,
      outstanding: 0,
    });
  });
});

describe('parseStatusFilter', () => {
  it('accepts valid statuses', () => {
    for (const s of ['all', 'paid', 'partial', 'unpaid', 'inactive'] as const) {
      expect(parseStatusFilter(s)).toBe(s);
    }
  });

  it('falls back to all for invalid or missing input', () => {
    expect(parseStatusFilter(undefined)).toBe('all');
    expect(parseStatusFilter('')).toBe('all');
    expect(parseStatusFilter('bogus')).toBe('all');
  });
});
