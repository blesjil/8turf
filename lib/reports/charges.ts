import { addDays, format, getDaysInMonth, parseISO } from 'date-fns';
import { countsTowardRent, creditForPeriod, isLeaseActiveForPeriod } from '@/lib/payment-status';

// Shared "rent due" primitives for the reports and the Payments Overview.
//
// The app has no bill/due-date entity — rent owed is derived from the lease and
// the payment ledger. These helpers give every covered month a single, correct
// due date (the lease-anniversary day) and a status that distinguishes "not yet
// due" from genuinely unpaid, so a tenant on a non-1st cycle isn't shown as
// delinquent before their anniversary day arrives.

// A charge covering `period` (YYYY-MM) is due on the lease's day-of-month,
// clamped to the month's length so a 31st anchor lands on Feb 28/29, Apr 30, etc.
export function anchorDueDate(leaseStartDate: string, period: string): string {
  const anchorDay = Number(leaseStartDate.slice(8, 10));
  const lastDay = getDaysInMonth(parseISO(`${period}-01`));
  const day = Math.min(anchorDay, lastDay);
  return `${period}-${String(day).padStart(2, '0')}`;
}

// Tenants get a short grace period past the due date before being flagged:
// nothing reads as overdue until `asOf` is more than this many days past due.
export const OVERDUE_GRACE_DAYS = 2;

export function isPastGracePeriod(dueDate: string, asOf: string): boolean {
  return asOf > format(addDays(parseISO(dueDate), OVERDUE_GRACE_DAYS), 'yyyy-MM-dd');
}

export type ChargeStatus = 'paid' | 'advance' | 'partial' | 'not_due' | 'unpaid' | 'overdue';

// The status of one derived monthly charge, evaluated at `asOf`:
//   paid     — fully covered
//   advance  — fully covered by a payment made before the due date
//   partial  — some, but not all, covered
//   not_due  — nothing paid and the due date is still in the future (the
//              mid-month false-"unpaid" fix — no reminder, not outstanding)
//   unpaid   — nothing paid, due, but still within the grace period
//   overdue  — nothing paid more than OVERDUE_GRACE_DAYS past the due date
export function chargeStatus(opts: {
  amount: number;
  creditsApplied: number;
  dueDate: string;
  asOf: string;
  latestPaidDate?: string | null;
}): ChargeStatus {
  const { amount, creditsApplied, dueDate, asOf, latestPaidDate } = opts;
  if (creditsApplied >= amount) {
    return latestPaidDate && latestPaidDate < dueDate ? 'advance' : 'paid';
  }
  if (creditsApplied > 0) return 'partial';
  if (asOf < dueDate) return 'not_due';
  if (isPastGracePeriod(dueDate, asOf)) return 'overdue';
  return 'unpaid';
}

// One active lease, flattened for charge derivation.
export interface LeaseInput {
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitLabel: string;
  tenantId: string;
  tenantName: string;
  rentAmount: number;
  leaseStartDate: string;
  leaseEndDate: string | null;
  isActive: boolean;
}

// A unit holds one occupant per month, but overlapping lease ranges (a tenant
// moving out mid-month as the next moves in) leave several leases "active" for
// the same month. Collapse them to the real occupant — the current tenant
// (is_active) wins, then the most recent lease — matching pickOccupant in the
// Payments Overview so charges never double-count a unit's rent.
function pickOccupant(leases: LeaseInput[]): LeaseInput {
  return leases.reduce((best, l) => {
    if (l.isActive !== best.isActive) return l.isActive ? l : best;
    return l.leaseStartDate > best.leaseStartDate ? l : best;
  });
}

// A rent payment as stored in the ledger (only the fields charge math needs).
export interface PaymentInput {
  tenantId: string;
  amount: number;
  period_start: string;
  period_end: string;
  payment_type: string;
  paid_date: string;
}

// A single derived monthly rent charge — the unit every report is built from.
export interface Charge extends Omit<
  LeaseInput,
  'leaseStartDate' | 'leaseEndDate' | 'rentAmount' | 'isActive'
> {
  period: string;
  dueDate: string;
  amount: number;
  creditsApplied: number;
  outstanding: number;
  lastPaymentDate: string | null;
  status: ChargeStatus;
}

// Derive one charge per active lease per covered period. Rent owed is the
// lease's rent_amount; credits come from the tenant's rent-covering payments
// (rental + advance) via the shared coverage split, so the numbers always match
// the Payments Overview. `asOf` drives the due/overdue/not-yet-due distinction.
export function deriveCharges(
  leases: LeaseInput[],
  payments: PaymentInput[],
  periods: string[],
  asOf: string,
): Charge[] {
  const paymentsByTenant = new Map<string, PaymentInput[]>();
  for (const p of payments) {
    if (!countsTowardRent(p.payment_type)) continue;
    const list = paymentsByTenant.get(p.tenantId);
    if (list) list.push(p);
    else paymentsByTenant.set(p.tenantId, [p]);
  }

  const charges: Charge[] = [];
  for (const period of periods) {
    // One charge per occupied unit: keep leases covering this period, then
    // collapse overlapping leases on the same unit to a single occupant.
    const leasesByUnit = new Map<string, LeaseInput[]>();
    for (const lease of leases) {
      if (!isLeaseActiveForPeriod(lease.leaseStartDate, lease.leaseEndDate, period)) continue;
      const list = leasesByUnit.get(lease.unitId);
      if (list) list.push(lease);
      else leasesByUnit.set(lease.unitId, [lease]);
    }

    for (const unitLeases of leasesByUnit.values()) {
      const { leaseStartDate, rentAmount, ...identity } = pickOccupant(unitLeases);
      const tenantPayments = paymentsByTenant.get(identity.tenantId) ?? [];
      let creditsApplied = 0;
      let lastPaymentDate: string | null = null;
      for (const p of tenantPayments) {
        const credit = creditForPeriod(p, period);
        if (credit <= 0) continue;
        creditsApplied += credit;
        if (!lastPaymentDate || p.paid_date > lastPaymentDate) lastPaymentDate = p.paid_date;
      }
      const dueDate = anchorDueDate(leaseStartDate, period);
      charges.push({
        propertyId: identity.propertyId,
        propertyName: identity.propertyName,
        unitId: identity.unitId,
        unitLabel: identity.unitLabel,
        tenantId: identity.tenantId,
        tenantName: identity.tenantName,
        period,
        dueDate,
        amount: rentAmount,
        creditsApplied,
        outstanding: Math.max(0, rentAmount - creditsApplied),
        lastPaymentDate,
        status: chargeStatus({
          amount: rentAmount,
          creditsApplied,
          dueDate,
          asOf,
          latestPaidDate: lastPaymentDate,
        }),
      });
    }
  }
  return charges;
}
