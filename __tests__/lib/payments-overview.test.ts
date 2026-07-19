import { describe, expect, it } from 'vitest';
import { pickOccupant } from '@/lib/payments-overview';
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
});
