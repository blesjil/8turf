import { differenceInCalendarDays, parseISO } from 'date-fns';
import { OVERDUE_GRACE_DAYS, type Charge } from '@/lib/reports/charges';

export interface OutstandingRow extends Charge {
  daysOverdue: number;
}

// Whole days past the due date as of `asOf`, floored at 0 (not yet due → 0).
export function daysOverdue(dueDate: string, asOf: string): number {
  const diff = differenceInCalendarDays(parseISO(asOf), parseISO(dueDate));
  return diff > 0 ? diff : 0;
}

// Charges still carrying a balance at `asOf`, annotated with days overdue.
export function buildOutstanding(charges: Charge[], asOf: string): OutstandingRow[] {
  return charges
    .filter((c) => c.outstanding > 0)
    .map((c) => ({ ...c, daysOverdue: daysOverdue(c.dueDate, asOf) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export interface OutstandingSummary {
  totalOutstanding: number;
  tenantsWithBalance: number;
  currentOutstanding: number;
  overdueOutstanding: number;
}

export function summarizeOutstanding(rows: OutstandingRow[]): OutstandingSummary {
  const tenants = new Set<string>();
  let totalOutstanding = 0;
  let currentOutstanding = 0;
  let overdueOutstanding = 0;
  for (const r of rows) {
    tenants.add(r.tenantId);
    totalOutstanding += r.outstanding;
    // daysOverdue stays the factual day count; the overdue *bucket* honors the
    // grace period so it matches the charge-status flag everywhere else.
    if (r.daysOverdue > OVERDUE_GRACE_DAYS) overdueOutstanding += r.outstanding;
    else currentOutstanding += r.outstanding;
  }
  return {
    totalOutstanding,
    tenantsWithBalance: tenants.size,
    currentOutstanding,
    overdueOutstanding,
  };
}
