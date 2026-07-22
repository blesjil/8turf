import { query } from '@/lib/db';
import type { LeaseInput, PaymentInput } from '@/lib/reports/charges';

// Every non-archived lease (tenant) visible to the scope, flattened for charge
// derivation. One row per tenant ever assigned to a unit; deriveCharges keeps
// only the periods each lease actually covers.
export function fetchLeases(scope: string | null): Promise<LeaseInput[]> {
  return query<LeaseInput>(
    `SELECT p.id as "propertyId", p.name as "propertyName",
            u.id as "unitId", u.unit_label as "unitLabel",
            t.id as "tenantId", t.name as "tenantName",
            t.rent_amount as "rentAmount", coalesce(t.is_active, false) as "isActive",
            t.lease_start_date as "leaseStartDate", t.lease_end_date as "leaseEndDate"
     FROM tenants t
     JOIN units u ON u.id = t.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE ($1::text IS NULL OR p.user_id = $1)
       AND p.archived_at IS NULL AND u.archived_at IS NULL
     ORDER BY p.name, u.unit_label`,
    [scope],
  );
}

// Rent payments whose coverage range overlaps [start, endExclusive). Used to
// credit charges; deriveCharges further filters to rent-covering types.
export function fetchCoveringPayments(
  scope: string | null,
  start: string,
  endExclusive: string,
): Promise<PaymentInput[]> {
  return query<PaymentInput>(
    `SELECT rp.tenant_id as "tenantId", rp.amount, rp.period_start, rp.period_end,
            rp.payment_type, rp.paid_date
     FROM rent_payments rp
     JOIN units u ON u.id = rp.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE ($1::text IS NULL OR p.user_id = $1)
       AND p.archived_at IS NULL AND u.archived_at IS NULL
       AND rp.period_start < $3 AND rp.period_end >= $2`,
    [scope, start, endExclusive],
  );
}
