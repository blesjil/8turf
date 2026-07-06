import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { formatCents } from '@/lib/money';
import { computePaymentStatus, isLeaseActiveForPeriod } from '@/lib/payment-status';
import { PaymentStatusBadge } from '@/components/payment-status-badge';
import { MonthPicker } from '@/components/month-picker';
import { PaymentsTabs } from '@/components/payments-tabs';

type SearchParams = Promise<{ month?: string }>;

interface Row {
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

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { month } = await searchParams;
  const period =
    month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);

  const rows = await query<Row>(
    `SELECT p.id as "propertyId", p.name as "propertyName",
            u.id as "unitId", u.unit_label as "unitLabel",
            t.id as "tenantId", t.name as "tenantName",
            t.rent_amount as "rentAmount", t.lease_start_date as "leaseStartDate", t.lease_end_date as "leaseEndDate"
     FROM tenants t
     JOIN units u ON u.id = t.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE p.user_id = $1 AND p.archived_at IS NULL AND u.archived_at IS NULL
     ORDER BY p.name, u.unit_label`,
    [session.user.id],
  );

  const relevantRows = rows.filter((r) =>
    isLeaseActiveForPeriod(r.leaseStartDate, r.leaseEndDate, period),
  );

  const paidByTenant = new Map<string, number>();
  if (relevantRows.length > 0) {
    const tenantIds = relevantRows.map((r) => r.tenantId);
    const totals = await query<{ tenant_id: string; total: number }>(
      `SELECT tenant_id, SUM(amount)::int as total FROM rent_payments
       WHERE period = $1 AND tenant_id = ANY($2) GROUP BY tenant_id`,
      [period, tenantIds],
    );
    for (const t of totals) paidByTenant.set(t.tenant_id, t.total);
  }

  return (
    <div className='p-8 max-w-5xl mx-auto'>
      <Link href='/dashboard' className='text-blue-600 hover:underline mb-4 inline-block'>
        &larr; Back to Properties
      </Link>

      <PaymentsTabs active='payments' isAdmin={session.user.role === 'admin'} />

      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold'>Payments Overview</h1>
        <MonthPicker value={period} />
      </div>

      {relevantRows.length === 0 ? (
        <p className='text-foreground/60'>No active leases for this month.</p>
      ) : (
        <table className='w-full text-sm border-collapse'>
          <thead>
            <tr className='text-left border-b border-border'>
              <th className='py-2 pr-4'>Property</th>
              <th className='py-2 pr-4'>Unit</th>
              <th className='py-2 pr-4'>Tenant</th>
              <th className='py-2 pr-4'>Rent</th>
              <th className='py-2 pr-4'>Paid</th>
              <th className='py-2 pr-4'>Status</th>
            </tr>
          </thead>
          <tbody>
            {relevantRows.map((r) => {
              const paid = paidByTenant.get(r.tenantId) ?? 0;
              const status = computePaymentStatus(paid, r.rentAmount);
              return (
                <tr key={r.tenantId} className='border-b border-border/50'>
                  <td className='py-2 pr-4'>{r.propertyName}</td>
                  <td className='py-2 pr-4'>
                    <Link
                      href={`/properties/${r.propertyId}/units/${r.unitId}`}
                      className='text-blue-600 hover:underline'
                    >
                      {r.unitLabel}
                    </Link>
                  </td>
                  <td className='py-2 pr-4'>{r.tenantName}</td>
                  <td className='py-2 pr-4'>{formatCents(r.rentAmount)}</td>
                  <td className='py-2 pr-4'>{formatCents(paid)}</td>
                  <td className='py-2 pr-4'>
                    <PaymentStatusBadge status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
