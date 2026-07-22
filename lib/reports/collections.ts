import { query } from '@/lib/db';

// A payment as received, for the Collections report (date basis: payment date).
export interface CollectionRow {
  paymentId: string;
  paidDate: string;
  tenantId: string;
  tenantName: string;
  propertyId: string;
  unitId: string;
  unitLabel: string;
  amount: number;
  method: string | null;
  paymentType: string;
  periodStart: string;
  periodEnd: string;
}

export type PaymentClass = 'advance' | 'on_time' | 'late';

// Classify a payment against the coverage it paid for, using only stored data:
//   advance — flagged advance, or paid before the coverage period started
//   late    — paid after the coverage period ended
//   on_time — paid during the coverage period
export function classifyPayment(p: {
  paidDate: string;
  periodStart: string;
  periodEnd: string;
  paymentType: string;
}): PaymentClass {
  if (p.paymentType === 'advance' || p.paidDate < p.periodStart) return 'advance';
  if (p.paidDate > p.periodEnd) return 'late';
  return 'on_time';
}

export interface CollectionsSummary {
  totalPayments: number;
  totalCollected: number;
  advance: number;
  late: number;
  byMethod: { method: string; amount: number }[];
}

export function summarizeCollections(rows: CollectionRow[]): CollectionsSummary {
  const byMethod = new Map<string, number>();
  let totalCollected = 0;
  let advance = 0;
  let late = 0;
  for (const r of rows) {
    totalCollected += r.amount;
    const method = r.method?.trim() || 'Unspecified';
    byMethod.set(method, (byMethod.get(method) ?? 0) + r.amount);
    const cls = classifyPayment({
      paidDate: r.paidDate,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      paymentType: r.paymentType,
    });
    if (cls === 'advance') advance += 1;
    else if (cls === 'late') late += 1;
  }
  return {
    totalPayments: rows.length,
    totalCollected,
    advance,
    late,
    byMethod: [...byMethod.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

// Payments actually received in [start, endExclusive) by payment date — the
// Collections report's core query.
export function fetchCollections(
  scope: string | null,
  start: string,
  endExclusive: string,
): Promise<CollectionRow[]> {
  return query<CollectionRow>(
    `SELECT rp.id as "paymentId", rp.paid_date as "paidDate",
            rp.tenant_id as "tenantId", t.name as "tenantName",
            p.id as "propertyId", u.id as "unitId", u.unit_label as "unitLabel",
            rp.amount, rp.method, rp.payment_type as "paymentType",
            rp.period_start as "periodStart", rp.period_end as "periodEnd"
     FROM rent_payments rp
     JOIN tenants t ON t.id = rp.tenant_id
     JOIN units u ON u.id = rp.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE ($1::text IS NULL OR p.user_id = $1)
       AND p.archived_at IS NULL AND u.archived_at IS NULL
       AND rp.paid_date >= $2 AND rp.paid_date < $3
     ORDER BY rp.paid_date DESC, t.name`,
    [scope, start, endExclusive],
  );
}
