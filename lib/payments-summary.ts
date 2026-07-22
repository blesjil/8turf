import { computePaymentStatus, type PaymentStatus } from '@/lib/payment-status';
import { anchorDueDate } from '@/lib/reports/charges';
import type { OverviewRow } from '@/lib/payments-overview';

export type RowStatus = PaymentStatus | 'not_due' | 'inactive';

export const STATUS_FILTERS = ['all', 'paid', 'partial', 'unpaid', 'not_due', 'inactive'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export function parseStatusFilter(raw: string | undefined): StatusFilter {
  return (STATUS_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as StatusFilter) : 'all';
}

// The status shown for a single overview row, evaluated as of `asOf`
// (YYYY-MM-DD, normally today). Vacant rows (no tenant) are 'inactive'.
//
// Rent runs on the lease-anniversary cycle, not the calendar month, so a tenant
// on a non-1st lease owes nothing until their anchor day. Before that day an
// otherwise-unpaid row is 'not_due', not 'unpaid' — this is what stops the
// mid-month view (and reminders) from flagging a current tenant as delinquent.
export function rowStatus(
  row: OverviewRow,
  paidByTenant: Map<string, number>,
  period: string,
  asOf: string,
): RowStatus {
  if (row.tenantId === null || row.leaseStartDate === null) return 'inactive';
  const rent = row.rentAmount ?? 0;
  const paid = paidByTenant.get(row.tenantId) ?? 0;
  if (paid >= rent) return 'paid';
  if (asOf < anchorDueDate(row.leaseStartDate, period)) return 'not_due';
  return computePaymentStatus(paid, rent); // 'partial' | 'unpaid'
}

// Whether a row is a reminder target: rent is due (anchor day reached) and not
// fully paid. 'not_due' and 'paid' rows are never chased.
export function isReminderDue(
  row: OverviewRow,
  paidByTenant: Map<string, number>,
  period: string,
  asOf: string,
): boolean {
  const status = rowStatus(row, paidByTenant, period, asOf);
  return status === 'unpaid' || status === 'partial';
}

export function filterRowsByStatus(
  rows: OverviewRow[],
  paidByTenant: Map<string, number>,
  filter: StatusFilter,
  period: string,
  asOf: string,
): OverviewRow[] {
  if (filter === 'all') return rows;
  return rows.filter((r) => rowStatus(r, paidByTenant, period, asOf) === filter);
}

export interface PaymentsSummary {
  activeLeases: number;
  unpaidLeases: number;
  vacantUnits: number;
  totalCollected: number;
  outstanding: number;
}

// Month totals for the summary cards. Always computed over the full, unfiltered
// rows — the status filter only narrows the table, never these numbers. Rent
// that is not yet due (before the tenant's anchor day) is excluded from unpaid
// leases and outstanding, so the totals reflect what is actually owed as of
// `asOf`; collected still counts every payment credited to the month.
export function summarizePayments(
  activeRows: OverviewRow[],
  inactiveRows: OverviewRow[],
  paidByTenant: Map<string, number>,
  period: string,
  asOf: string,
): PaymentsSummary {
  let unpaidLeases = 0;
  let totalCollected = 0;
  let outstanding = 0;
  for (const r of activeRows) {
    const rent = r.rentAmount ?? 0;
    const paid = paidByTenant.get(r.tenantId!) ?? 0;
    totalCollected += Math.min(paid, rent);
    if (isReminderDue(r, paidByTenant, period, asOf)) {
      unpaidLeases++;
      outstanding += rent - paid;
    }
  }
  return {
    activeLeases: activeRows.length,
    unpaidLeases,
    vacantUnits: inactiveRows.length,
    totalCollected,
    outstanding,
  };
}
