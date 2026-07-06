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
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className='gap-1 py-4'>
      <CardHeader className='gap-1'>
        <CardDescription>{label}</CardDescription>
        <CardTitle className='font-mono text-2xl tabular-nums'>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
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

  const totalDue = relevantRows.reduce((sum, r) => sum + r.rentAmount, 0);
  const totalCollected = relevantRows.reduce(
    (sum, r) => sum + Math.min(paidByTenant.get(r.tenantId) ?? 0, r.rentAmount),
    0,
  );
  const outstanding = Math.max(totalDue - totalCollected, 0);

  return (
    <div className='mx-auto max-w-6xl p-4 sm:p-8'>
      <PaymentsTabs active='payments' isAdmin={session.user.role === 'admin'} />

      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-2xl font-semibold tracking-tight'>Payments Overview</h1>
        <MonthPicker value={period} />
      </div>

      {relevantRows.length === 0 ? (
        <Card className='py-8 text-center'>
          <CardHeader className='items-center'>
            <CardTitle>No active leases</CardTitle>
            <CardDescription>No units have an active lease for this month.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className='mb-6 grid gap-4 sm:grid-cols-3'>
            <StatCard label='Active leases' value={String(relevantRows.length)} />
            <StatCard label='Rent collected' value={formatCents(totalCollected)} />
            <StatCard label='Outstanding' value={formatCents(outstanding)} />
          </div>

          <Card className='py-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='hidden md:table-cell'>Property</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead className='hidden text-right sm:table-cell'>Rent</TableHead>
                    <TableHead className='text-right'>Paid</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relevantRows.map((r) => {
                    const paid = paidByTenant.get(r.tenantId) ?? 0;
                    const status = computePaymentStatus(paid, r.rentAmount);
                    return (
                      <TableRow key={r.tenantId}>
                        <TableCell className='hidden md:table-cell'>{r.propertyName}</TableCell>
                        <TableCell>
                          <Link
                            href={`/properties/${r.propertyId}/units/${r.unitId}`}
                            className='font-mono font-medium text-primary hover:underline'
                          >
                            {r.unitLabel}
                          </Link>
                        </TableCell>
                        <TableCell>{r.tenantName}</TableCell>
                        <TableCell className='hidden text-right font-mono tabular-nums sm:table-cell'>
                          {formatCents(r.rentAmount)}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {formatCents(paid)}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
