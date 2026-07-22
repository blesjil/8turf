import { getDaysInMonth, parseISO } from 'date-fns';
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

export type ChargeStatus = 'paid' | 'advance' | 'partial' | 'not_due' | 'unpaid' | 'overdue';

// The status of one derived monthly charge, evaluated at `asOf`:
//   paid     — fully covered
//   advance  — fully covered by a payment made before the due date
//   partial  — some, but not all, covered
//   not_due  — nothing paid and the due date is still in the future (the
//              mid-month false-"unpaid" fix — no reminder, not outstanding)
//   unpaid   — nothing paid and due today
//   overdue  — nothing paid past the due date
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
  if (asOf > dueDate) return 'overdue';
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
export interface Charge extends Omit<LeaseInput, 'leaseStartDate' | 'leaseEndDate' | 'rentAmount'> {
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
  for (const lease of leases) {
    const { leaseStartDate, leaseEndDate, rentAmount, ...identity } = lease;
    const tenantPayments = paymentsByTenant.get(lease.tenantId) ?? [];
    for (const period of periods) {
      if (!isLeaseActiveForPeriod(leaseStartDate, leaseEndDate, period)) continue;
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
        ...identity,
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
