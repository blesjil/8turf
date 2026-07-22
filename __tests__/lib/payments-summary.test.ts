import { describe, expect, it } from 'vitest';
import type { OverviewRow } from '@/lib/payments-overview';
import {
  filterRowsByStatus,
  isReminderDue,
  parseStatusFilter,
  rowStatus,
  summarizePayments,
} from '@/lib/payments-summary';

const PERIOD = '2026-08';
// A day after a 1st-of-month due date but before a mid-month one, so a 1st
// lease reads as due while a 15th lease reads as not-yet-due.
const ASOF = '2026-08-05';

// Minimal OverviewRow factory; only the fields the summary helpers read matter.
// Default lease anchors on the 1st, so with ASOF it is already due.
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
    expect(rowStatus(row({ tenantId: null, rentAmount: null }), paid, PERIOD, ASOF)).toBe(
      'inactive',
    );
  });

  it('returns paid when paid covers rent, regardless of due date', () => {
    expect(rowStatus(row({ tenantId: 'paidTenant' }), paid, PERIOD, ASOF)).toBe('paid');
    // Even fully paid before a mid-month due date reads as paid, not not_due.
    expect(
      rowStatus(row({ tenantId: 'paidTenant', leaseStartDate: '2026-08-15' }), paid, PERIOD, ASOF),
    ).toBe('paid');
  });

  it('returns partial when some but not all rent is paid and it is due', () => {
    expect(rowStatus(row({ tenantId: 'partialTenant' }), paid, PERIOD, ASOF)).toBe('partial');
  });

  it('returns unpaid when nothing is paid and it is due', () => {
    expect(rowStatus(row({ tenantId: 'unpaidTenant' }), paid, PERIOD, ASOF)).toBe('unpaid');
  });

  it('returns not_due when the anchor day has not arrived yet', () => {
    // 15th lease, viewed on the 5th → rent not due yet, so an unpaid tenant is
    // "not yet due" rather than delinquent (the mid-month fix).
    expect(
      rowStatus(
        row({ tenantId: 'unpaidTenant', leaseStartDate: '2026-08-15' }),
        paid,
        PERIOD,
        ASOF,
      ),
    ).toBe('not_due');
  });

  it('not_due takes precedence over partial before the due date', () => {
    expect(
      rowStatus(
        row({ tenantId: 'partialTenant', leaseStartDate: '2026-08-15' }),
        paid,
        PERIOD,
        ASOF,
      ),
    ).toBe('not_due');
  });

  it('treats a null rent amount as zero (rentAmount ?? 0 branch)', () => {
    expect(rowStatus(row({ tenantId: 'paidTenant', rentAmount: null }), paid, PERIOD, ASOF)).toBe(
      'paid',
    );
    expect(rowStatus(row({ tenantId: 'unpaidTenant', rentAmount: null }), paid, PERIOD, ASOF)).toBe(
      'paid',
    );
  });
});

describe('isReminderDue', () => {
  it('is true only for due-and-owing rows', () => {
    expect(isReminderDue(row({ tenantId: 'unpaidTenant' }), paid, PERIOD, ASOF)).toBe(true);
    expect(isReminderDue(row({ tenantId: 'partialTenant' }), paid, PERIOD, ASOF)).toBe(true);
  });

  it('is false for paid and not-yet-due rows', () => {
    expect(isReminderDue(row({ tenantId: 'paidTenant' }), paid, PERIOD, ASOF)).toBe(false);
    expect(
      isReminderDue(
        row({ tenantId: 'unpaidTenant', leaseStartDate: '2026-08-15' }),
        paid,
        PERIOD,
        ASOF,
      ),
    ).toBe(false);
  });
});

describe('filterRowsByStatus', () => {
  const rows = [
    row({ tenantId: 'paidTenant' }),
    row({ tenantId: 'partialTenant' }),
    row({ tenantId: 'unpaidTenant' }),
    row({ tenantId: 'notDueTenant', leaseStartDate: '2026-08-15' }), // 0 paid, before due
    row({ tenantId: null, rentAmount: null }),
  ];

  it('passes every row through when filter is all', () => {
    expect(filterRowsByStatus(rows, paid, 'all', PERIOD, ASOF)).toHaveLength(5);
  });

  it('narrows to a single status', () => {
    expect(filterRowsByStatus(rows, paid, 'paid', PERIOD, ASOF).map((r) => r.tenantId)).toEqual([
      'paidTenant',
    ]);
    expect(filterRowsByStatus(rows, paid, 'not_due', PERIOD, ASOF).map((r) => r.tenantId)).toEqual([
      'notDueTenant',
    ]);
    expect(filterRowsByStatus(rows, paid, 'unpaid', PERIOD, ASOF).map((r) => r.tenantId)).toEqual([
      'unpaidTenant',
    ]);
  });

  it('inactive filter keeps only vacant rows', () => {
    const result = filterRowsByStatus(rows, paid, 'inactive', PERIOD, ASOF);
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
    const summary = summarizePayments(active, inactive, paid, PERIOD, ASOF);

    expect(summary.activeLeases).toBe(3);
    expect(summary.unpaidLeases).toBe(2); // partial + unpaid
    expect(summary.vacantUnits).toBe(2);
  });

  it('excludes not-yet-due leases from unpaid count and outstanding', () => {
    const active = [
      row({ tenantId: 'unpaidTenant' }), // due, owes 100000
      row({ tenantId: 'notDueTenant', leaseStartDate: '2026-08-15' }), // not due yet
    ];
    const summary = summarizePayments(active, [], paid, PERIOD, ASOF);

    expect(summary.unpaidLeases).toBe(1); // only the due one
    expect(summary.outstanding).toBe(100000); // not_due lease adds nothing
  });

  it('caps collected at rent (ignores overpayment) and sums outstanding for due rows', () => {
    const active = [
      row({ tenantId: 'overpaidTenant', rentAmount: 100000 }), // paid 150000, capped to 100000
      row({ tenantId: 'partialTenant', rentAmount: 100000 }), // paid 40000, due
    ];
    const summary = summarizePayments(active, [], paid, PERIOD, ASOF);

    expect(summary.totalCollected).toBe(140000); // 100000 capped + 40000
    expect(summary.outstanding).toBe(60000); // only the partial row still owes
  });

  it('returns zeros for an empty month', () => {
    expect(summarizePayments([], [], paid, PERIOD, ASOF)).toEqual({
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
    for (const s of ['all', 'paid', 'partial', 'unpaid', 'not_due', 'inactive'] as const) {
      expect(parseStatusFilter(s)).toBe(s);
    }
  });

  it('falls back to all for invalid or missing input', () => {
    expect(parseStatusFilter(undefined)).toBe('all');
    expect(parseStatusFilter('')).toBe('all');
    expect(parseStatusFilter('bogus')).toBe('all');
  });
});
