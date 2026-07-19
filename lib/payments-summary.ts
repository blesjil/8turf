import { computePaymentStatus, type PaymentStatus } from '@/lib/payment-status';
import type { OverviewRow } from '@/lib/payments-overview';

export type RowStatus = PaymentStatus | 'inactive';

export const STATUS_FILTERS = ['all', 'paid', 'partial', 'unpaid', 'inactive'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export function parseStatusFilter(raw: string | undefined): StatusFilter {
  return (STATUS_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as StatusFilter) : 'all';
}

// The status shown for a single overview row: vacant rows (no tenant) are
// 'inactive', everyone else is driven by the shared paid-vs-rent math so the
// filter can't disagree with the badge the table renders.
export function rowStatus(row: OverviewRow, paidByTenant: Map<string, number>): RowStatus {
  if (row.tenantId === null) return 'inactive';
  return computePaymentStatus(paidByTenant.get(row.tenantId) ?? 0, row.rentAmount ?? 0);
}

export function filterRowsByStatus(
  rows: OverviewRow[],
  paidByTenant: Map<string, number>,
  filter: StatusFilter,
): OverviewRow[] {
  if (filter === 'all') return rows;
  return rows.filter((r) => rowStatus(r, paidByTenant) === filter);
}

export interface PaymentsSummary {
  activeLeases: number;
  unpaidLeases: number;
  vacantUnits: number;
  totalCollected: number;
  outstanding: number;
}

// Month totals for the summary cards. Always computed over the full, unfiltered
// rows — the status filter only narrows the table, never these numbers.
export function summarizePayments(
  activeRows: OverviewRow[],
  inactiveRows: OverviewRow[],
  paidByTenant: Map<string, number>,
): PaymentsSummary {
  let unpaidLeases = 0;
  let totalDue = 0;
  let totalCollected = 0;
  for (const r of activeRows) {
    const rent = r.rentAmount ?? 0;
    const paid = paidByTenant.get(r.tenantId!) ?? 0;
    if (paid < rent) unpaidLeases++;
    totalDue += rent;
    totalCollected += Math.min(paid, rent);
  }
  return {
    activeLeases: activeRows.length,
    unpaidLeases,
    vacantUnits: inactiveRows.length,
    totalCollected,
    outstanding: Math.max(totalDue - totalCollected, 0),
  };
}
