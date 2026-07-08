import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { format } from 'date-fns';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { query } from '@/lib/db';
import { formatCents } from '@/lib/money';
import { formatPeriod } from '@/lib/format-date';
import { computePaymentStatus } from '@/lib/payment-status';
import { getPaymentsOverview } from '@/lib/payments-overview';
import { PaymentStatusBadge } from '@/components/payment-status-badge';
import { MonthPicker } from '@/components/month-picker';
import { PaymentsTabs } from '@/components/payments-tabs';
import { SendReminderButton } from '@/components/send-reminder-button';
import { RemindAllButton } from '@/components/remind-all-button';
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

  const { activeRows, inactiveRows, paidByTenant } = await getPaymentsOverview(
    period,
    ownerScope(session),
  );
  const allRows = [...activeRows, ...inactiveRows];

  const lastRemindedByTenant = new Map<string, string>();
  if (activeRows.length > 0) {
    const reminders = await query<{ tenant_id: string; sent_at: Date }>(
      `SELECT DISTINCT ON (tenant_id) tenant_id, sent_at FROM payment_reminders
       WHERE period = $1 AND tenant_id = ANY($2)
       ORDER BY tenant_id, sent_at DESC`,
      [period, activeRows.map((r) => r.tenantId!)],
    );
    for (const r of reminders) {
      lastRemindedByTenant.set(r.tenant_id, format(r.sent_at, 'MMM d, yyyy'));
    }
  }

  const unpaidRows = activeRows.filter(
    (r) => (paidByTenant.get(r.tenantId!) ?? 0) < (r.rentAmount ?? 0),
  );
  const unpaidWithEmail = unpaidRows.filter((r) => r.tenantEmail).length;

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
        <div className='flex flex-wrap items-center gap-2'>
          <MonthPicker value={period} />
          <RemindAllButton
            period={period}
            monthLabel={formatPeriod(period)}
            unpaidWithEmail={unpaidWithEmail}
            unpaidWithoutEmail={unpaidRows.length - unpaidWithEmail}
          />
        </div>
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
                    <TableHead className='text-right'>
                      <span className='sr-only'>Reminder</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginate(allRows, page).map((r) => {
                    // Inactive/vacant rows come back with tenant fields nulled.
                    const active = r.tenantId !== null;
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
                        <TableCell className='text-right'>
                          {active &&
                            status !== 'paid' &&
                            (r.tenantEmail ? (
                              <SendReminderButton
                                tenantId={r.tenantId!}
                                period={period}
                                lastRemindedAt={lastRemindedByTenant.get(r.tenantId!) ?? null}
                              />
                            ) : (
                              <span className='text-xs text-muted-foreground'>No email</span>
                            ))}
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
