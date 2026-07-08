import { endOfMonth, format, parseISO } from 'date-fns';
import { query } from '@/lib/db';
import { creditForPeriod, isLeaseActiveForPeriod } from '@/lib/payment-status';

export interface OverviewRow {
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitLabel: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  rentAmount: number | null;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
}

export interface PaymentsOverview {
  /** One row per tenant whose lease covers the period; tenant fields non-null. */
  activeRows: OverviewRow[];
  /** One vacant row per unit with no covering lease; tenant fields nulled. */
  inactiveRows: OverviewRow[];
  /** Rent credited to the period per active tenant, in integer cents. */
  paidByTenant: Map<string, number>;
}

// The per-month paid/unpaid math shared by the Payments Overview page and the
// due-reminder actions, so the status a reminder is based on can't drift from
// what the table shows.
export async function getPaymentsOverview(
  period: string,
  scope: string | null,
): Promise<PaymentsOverview> {
  const rows = await query<OverviewRow>(
    `SELECT p.id as "propertyId", p.name as "propertyName",
            u.id as "unitId", u.unit_label as "unitLabel",
            t.id as "tenantId", t.name as "tenantName", t.email as "tenantEmail",
            t.rent_amount as "rentAmount", t.lease_start_date as "leaseStartDate", t.lease_end_date as "leaseEndDate"
     FROM units u
     LEFT JOIN tenants t ON t.unit_id = u.id
     JOIN properties p ON p.id = u.property_id
     WHERE ($1::text IS NULL OR p.user_id = $1) AND p.archived_at IS NULL AND u.archived_at IS NULL
     ORDER BY p.name, u.unit_label`,
    [scope],
  );

  const isActive = (r: OverviewRow) =>
    r.tenantId !== null &&
    r.leaseStartDate !== null &&
    isLeaseActiveForPeriod(r.leaseStartDate, r.leaseEndDate, period);

  // The tenants join yields one row per tenant ever assigned to a unit. Keep
  // the rows whose lease covers the selected month; collapse the rest into a
  // single vacant row per unit so past tenants don't show as duplicates.
  const rowsByUnit = new Map<string, OverviewRow[]>();
  for (const r of rows) {
    const unitRows = rowsByUnit.get(r.unitId);
    if (unitRows) unitRows.push(r);
    else rowsByUnit.set(r.unitId, [r]);
  }
  const activeRows: OverviewRow[] = [];
  const inactiveRows: OverviewRow[] = [];
  for (const unitRows of rowsByUnit.values()) {
    const covering = unitRows.filter(isActive);
    if (covering.length > 0) {
      activeRows.push(...covering);
    } else {
      inactiveRows.push({
        ...unitRows[0],
        tenantId: null,
        tenantName: null,
        tenantEmail: null,
        rentAmount: null,
        leaseStartDate: null,
        leaseEndDate: null,
      });
    }
  }

  const paidByTenant = new Map<string, number>();
  if (activeRows.length > 0) {
    const tenantIds = activeRows.map((r) => r.tenantId!);
    // Multi-month payments credit each covered month a share of the amount, so
    // fetch every range overlapping this month and let creditForPeriod decide
    // how much (possibly 0) lands in it.
    const monthStart = `${period}-01`;
    const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');
    const payments = await query<{
      tenant_id: string;
      amount: number;
      period_start: string;
      period_end: string;
    }>(
      `SELECT tenant_id, amount, period_start, period_end FROM rent_payments
       WHERE tenant_id = ANY($1) AND payment_type IN ('rental', 'advance')
         AND period_start <= $2 AND period_end >= $3`,
      [tenantIds, monthEnd, monthStart],
    );
    for (const p of payments) {
      const credit = creditForPeriod(p, period);
      if (credit > 0) paidByTenant.set(p.tenant_id, (paidByTenant.get(p.tenant_id) ?? 0) + credit);
    }
  }

  return { activeRows, inactiveRows, paidByTenant };
}
