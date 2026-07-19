import { beforeEach, describe, expect, it, vi } from 'vitest';

// getPaymentsOverview issues two queries (rows, then payments). Mock the db
// layer and drive both via mockResolvedValueOnce in call order.
const query = vi.fn();
vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => query(...args),
}));

import { getPaymentsOverview, pickOccupant } from '@/lib/payments-overview';
import type { OverviewRow } from '@/lib/payments-overview';

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

describe('pickOccupant', () => {
  it('prefers the current occupant (is_active) when leases overlap', () => {
    // A moved-out tenant whose short lease still overlaps the month, plus the
    // current ongoing tenant — the flagged current occupant must win.
    const former = row({
      tenantId: 'former',
      isActive: false,
      leaseStartDate: '2026-07-01',
      leaseEndDate: '2026-07-09',
    });
    const current = row({
      tenantId: 'current',
      isActive: true,
      leaseStartDate: '2026-06-30',
      leaseEndDate: null,
    });
    expect(pickOccupant([former, current]).tenantId).toBe('current');
    expect(pickOccupant([current, former]).tenantId).toBe('current');
  });

  it('falls back to the most recent lease when none is flagged active', () => {
    const older = row({ tenantId: 'older', isActive: false, leaseStartDate: '2026-05-01' });
    const newer = row({ tenantId: 'newer', isActive: false, leaseStartDate: '2026-06-01' });
    expect(pickOccupant([older, newer]).tenantId).toBe('newer');
  });

  it('returns the sole row unchanged', () => {
    expect(pickOccupant([row({ tenantId: 'solo' })]).tenantId).toBe('solo');
  });

  it('treats null lease start dates as the earliest when tie-breaking', () => {
    const noStart = row({ tenantId: 'noStart', isActive: false, leaseStartDate: null });
    const dated = row({ tenantId: 'dated', isActive: false, leaseStartDate: '2026-01-01' });
    expect(pickOccupant([noStart, dated]).tenantId).toBe('dated');
    expect(pickOccupant([dated, noStart]).tenantId).toBe('dated');
  });
});

describe('getPaymentsOverview', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('splits units into active (lease covers period) and vacant rows', async () => {
    query
      .mockResolvedValueOnce([
        row({ unitId: 'u1', tenantId: 'occupied', leaseStartDate: '2026-01-01' }),
        // Tenant is flagged is_active but the lease only starts next month, so
        // the unit is vacant *for this period* — and the vacant row must not
        // leak isActive:true.
        row({
          unitId: 'u2',
          tenantId: 'future',
          isActive: true,
          leaseStartDate: '2026-08-01',
          leaseEndDate: null,
        }),
      ])
      .mockResolvedValueOnce([]); // no payments

    const { activeRows, inactiveRows } = await getPaymentsOverview('2026-07', null);

    expect(activeRows.map((r) => r.tenantId)).toEqual(['occupied']);
    expect(inactiveRows).toHaveLength(1);
    expect(inactiveRows[0].unitId).toBe('u2');
    expect(inactiveRows[0].tenantId).toBeNull();
    expect(inactiveRows[0].tenantName).toBeNull();
    expect(inactiveRows[0].rentAmount).toBeNull();
    expect(inactiveRows[0].isActive).toBe(false);
  });

  it('collapses overlapping covering leases to one occupant per unit', async () => {
    query
      .mockResolvedValueOnce([
        row({
          unitId: 'u1',
          tenantId: 'former',
          isActive: false,
          leaseStartDate: '2026-07-01',
          leaseEndDate: '2026-07-09',
        }),
        row({
          unitId: 'u1',
          tenantId: 'current',
          isActive: true,
          leaseStartDate: '2026-06-30',
          leaseEndDate: null,
        }),
      ])
      .mockResolvedValueOnce([]);

    const { activeRows } = await getPaymentsOverview('2026-07', null);
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0].tenantId).toBe('current');
  });

  it('credits only the selected period from a multi-month payment', async () => {
    query
      .mockResolvedValueOnce([row({ unitId: 'u1', tenantId: 't1', rentAmount: 100000 })])
      // A 3-month payment of 300000 covering Jul–Sep credits 100000 to July.
      .mockResolvedValueOnce([
        { tenant_id: 't1', amount: 300000, period_start: '2026-07-01', period_end: '2026-09-30' },
      ]);

    const { paidByTenant } = await getPaymentsOverview('2026-07', null);
    expect(paidByTenant.get('t1')).toBe(100000);
  });

  it('credits nothing when an overlapping payment anchors to a different month', async () => {
    query
      .mockResolvedValueOnce([row({ unitId: 'u1', tenantId: 't1', rentAmount: 100000 })])
      // Jul 20 – Aug 5 overlaps August's window but anchors as a single July
      // stay-month (the midpoint rule), so August is credited 0.
      .mockResolvedValueOnce([
        { tenant_id: 't1', amount: 100000, period_start: '2026-07-20', period_end: '2026-08-05' },
      ]);

    const { paidByTenant } = await getPaymentsOverview('2026-08', null);
    expect(paidByTenant.has('t1')).toBe(false);
  });

  it('sums multiple payments landing in the same period', async () => {
    query
      .mockResolvedValueOnce([row({ unitId: 'u1', tenantId: 't1', rentAmount: 100000 })])
      .mockResolvedValueOnce([
        { tenant_id: 't1', amount: 40000, period_start: '2026-07-01', period_end: '2026-07-31' },
        { tenant_id: 't1', amount: 60000, period_start: '2026-07-01', period_end: '2026-07-31' },
      ]);

    const { paidByTenant } = await getPaymentsOverview('2026-07', null);
    expect(paidByTenant.get('t1')).toBe(100000);
  });

  it('skips the payments query entirely when there are no active leases', async () => {
    query.mockResolvedValueOnce([]); // no units/tenants at all

    const { activeRows, inactiveRows, paidByTenant } = await getPaymentsOverview('2026-07', null);
    expect(activeRows).toEqual([]);
    expect(inactiveRows).toEqual([]);
    expect(paidByTenant.size).toBe(0);
    expect(query).toHaveBeenCalledTimes(1); // second (payments) query never runs
  });

  it('scopes the rows query by owner when a scope is given', async () => {
    query.mockResolvedValueOnce([]);
    await getPaymentsOverview('2026-07', 'user-1');

    const [, params] = query.mock.calls[0];
    expect(params).toEqual(['user-1']);
  });

  it('passes the month bounds to the payments query', async () => {
    query.mockResolvedValueOnce([row({ unitId: 'u1', tenantId: 't1' })]).mockResolvedValueOnce([]);
    await getPaymentsOverview('2026-02', null);

    const [, params] = query.mock.calls[1];
    // [tenantIds, monthEnd, monthStart] — Feb 2026 has 28 days.
    expect(params[0]).toEqual(['t1']);
    expect(params[1]).toBe('2026-02-28');
    expect(params[2]).toBe('2026-02-01');
  });
});
