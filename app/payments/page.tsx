import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { format } from 'date-fns';
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
import { PAGE_SIZE, PaginationNav, clampPage, paginate } from '@/components/ui/pagination';

type SearchParams = Promise<{ month?: string; page?: string }>;

interface Row {
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitLabel: string;
  tenantId: string | null;
  tenantName: string | null;
  rentAmount: number | null;
  leaseStartDate: string | null;
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

  const { month, page: rawPage } = await searchParams;
  const period = month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), 'yyyy-MM');

  const rows = await query<Row>(
    `SELECT p.id as "propertyId", p.name as "propertyName",
            u.id as "unitId", u.unit_label as "unitLabel",
            t.id as "tenantId", t.name as "tenantName",
            t.rent_amount as "rentAmount", t.lease_start_date as "leaseStartDate", t.lease_end_date as "leaseEndDate"
     FROM units u
     LEFT JOIN tenants t ON t.unit_id = u.id
     JOIN properties p ON p.id = u.property_id
     WHERE p.user_id = $1 AND p.archived_at IS NULL AND u.archived_at IS NULL
     ORDER BY p.name, u.unit_label`,
    [session.user.id],
  );

  const isActive = (r: Row) =>
    r.tenantId !== null &&
    r.leaseStartDate !== null &&
    isLeaseActiveForPeriod(r.leaseStartDate, r.leaseEndDate, period);

  // The tenants join yields one row per tenant ever assigned to a unit. Keep
  // the rows whose lease covers the selected month; collapse the rest into a
  // single vacant row per unit so past tenants don't show as duplicates.
  const rowsByUnit = new Map<string, Row[]>();
  for (const r of rows) {
    const unitRows = rowsByUnit.get(r.unitId);
    if (unitRows) unitRows.push(r);
    else rowsByUnit.set(r.unitId, [r]);
  }
  const activeRows: Row[] = [];
  const inactiveRows: Row[] = [];
  for (const unitRows of rowsByUnit.values()) {
    const covering = unitRows.filter(isActive);
    if (covering.length > 0) {
      activeRows.push(...covering);
    } else {
      inactiveRows.push({
        ...unitRows[0],
        tenantId: null,
        tenantName: null,
        rentAmount: null,
        leaseStartDate: null,
        leaseEndDate: null,
      });
    }
  }
  const allRows = [...activeRows, ...inactiveRows];

  const paidByTenant = new Map<string, number>();
  if (activeRows.length > 0) {
    const tenantIds = activeRows.map((r) => r.tenantId!);
    const totals = await query<{ tenant_id: string; total: number }>(
      `SELECT tenant_id, SUM(amount)::int as total FROM rent_payments
       WHERE period = $1 AND tenant_id = ANY($2)
         AND payment_type IN ('rental', 'advance')
       GROUP BY tenant_id`,
      [period, tenantIds],
    );
    for (const t of totals) paidByTenant.set(t.tenant_id, t.total);
  }

  const totalDue = activeRows.reduce((sum, r) => sum + (r.rentAmount ?? 0), 0);
  const totalCollected = activeRows.reduce(
    (sum, r) => sum + Math.min(paidByTenant.get(r.tenantId!) ?? 0, r.rentAmount ?? 0),
    0,
  );
  const outstanding = Math.max(totalDue - totalCollected, 0);

  const totalPages = Math.ceil(allRows.length / PAGE_SIZE);
  const page = clampPage(rawPage, totalPages);

  return (
    <div className='mx-auto max-w-6xl p-4 sm:p-8'>
      <PaymentsTabs active='payments' isAdmin={session.user.role === 'admin'} />

      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-2xl font-semibold tracking-tight'>Payments Overview</h1>
        <MonthPicker value={period} />
      </div>

      {allRows.length === 0 ? (
        <Card className='py-8 text-center'>
          <CardHeader className='items-center'>
            <CardTitle>No units yet</CardTitle>
            <CardDescription>Add a property with units to track rent payments.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className='mb-6 grid gap-4 sm:grid-cols-3'>
            <StatCard label='Active leases' value={String(activeRows.length)} />
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
                  {paginate(allRows, page).map((r) => {
                    const active = isActive(r);
                    const paid = active ? (paidByTenant.get(r.tenantId!) ?? 0) : 0;
                    const status = active
                      ? computePaymentStatus(paid, r.rentAmount ?? 0)
                      : 'inactive';
                    return (
                      <TableRow key={r.tenantId ?? r.unitId}>
                        <TableCell className='hidden md:table-cell'>{r.propertyName}</TableCell>
                        <TableCell>
                          <Link
                            href={`/properties/${r.propertyId}/units/${r.unitId}`}
                            className='font-mono font-medium text-primary hover:underline'
                          >
                            {r.unitLabel}
                          </Link>
                        </TableCell>
                        <TableCell className={r.tenantName ? '' : 'text-muted-foreground'}>
                          {r.tenantName ?? '—'}
                        </TableCell>
                        <TableCell className='hidden text-right font-mono tabular-nums sm:table-cell'>
                          {r.rentAmount !== null ? formatCents(r.rentAmount) : '—'}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {active ? formatCents(paid) : '—'}
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
          <PaginationNav
            page={page}
            totalPages={totalPages}
            basePath='/payments'
            params={{ month: period }}
          />
        </>
      )}
    </div>
  );
}
