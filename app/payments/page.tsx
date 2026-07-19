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
import { filterRowsByStatus, parseStatusFilter, summarizePayments } from '@/lib/payments-summary';
import {
  BanknoteIcon,
  Building2Icon,
  TriangleAlertIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';
import { PaymentStatusBadge } from '@/components/payment-status-badge';
import { KpiCard } from '@/components/kpi-card';
import { MonthPicker } from '@/components/month-picker';
import { PaymentStatusFilter } from '@/components/payment-status-filter';
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

type SearchParams = Promise<{ month?: string; status?: string; page?: string }>;

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { month, status, page: rawPage } = await searchParams;
  const period = month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), 'yyyy-MM');
  const filter = parseStatusFilter(status);

  const { activeRows, inactiveRows, paidByTenant } = await getPaymentsOverview(
    period,
    ownerScope(session),
  );
  const totalRowCount = activeRows.length + inactiveRows.length;

  // The status filter narrows only the table; the summary cards below always
  // reflect the month's full totals.
  const filteredActive = filterRowsByStatus(activeRows, paidByTenant, filter);
  const filteredInactive = filter === 'all' || filter === 'inactive' ? inactiveRows : [];
  const allRows = [...filteredActive, ...filteredInactive];

  const lastRemindedByTenant = new Map<string, { date: string; channel: string }>();
  if (activeRows.length > 0) {
    const reminders = await query<{ tenant_id: string; sent_at: Date; channel: string }>(
      `SELECT DISTINCT ON (tenant_id) tenant_id, sent_at, channel FROM payment_reminders
       WHERE period = $1 AND tenant_id = ANY($2)
       ORDER BY tenant_id, sent_at DESC`,
      [period, activeRows.map((r) => r.tenantId!)],
    );
    for (const r of reminders) {
      lastRemindedByTenant.set(r.tenant_id, {
        date: format(r.sent_at, 'MMM d, yyyy'),
        channel: r.channel,
      });
    }
  }

  // Remind-all targets every unpaid tenant regardless of the current filter.
  const unpaidRows = activeRows.filter(
    (r) => (paidByTenant.get(r.tenantId!) ?? 0) < (r.rentAmount ?? 0),
  );
  const unpaidWithContact = unpaidRows.filter((r) => r.tenantEmail || r.tenantPhone).length;

  const summary = summarizePayments(activeRows, inactiveRows, paidByTenant);

  const totalPages = Math.ceil(allRows.length / PAGE_SIZE);
  const page = clampPage(rawPage, totalPages);

  return (
    <div className='mx-auto max-w-6xl p-4 sm:p-8'>
      <PaymentsTabs active='payments' isAdmin={session.user.role === 'admin'} />

      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <h1 className='font-heading text-2xl font-semibold tracking-tight'>Payments Overview</h1>
        <div className='flex flex-wrap items-center gap-2'>
          <MonthPicker value={period} />
          <PaymentStatusFilter period={period} value={filter} />
          <RemindAllButton
            period={period}
            monthLabel={formatPeriod(period)}
            unpaidWithContact={unpaidWithContact}
            unpaidWithoutContact={unpaidRows.length - unpaidWithContact}
          />
        </div>
      </div>

      {totalRowCount === 0 ? (
        <Card className='py-8 text-center'>
          <CardHeader className='items-center'>
            <CardTitle>No units yet</CardTitle>
            <CardDescription>Add a property with units to track rent payments.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className='mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5'>
            <KpiCard
              label='Active leases'
              value={String(summary.activeLeases)}
              icon={<UsersIcon />}
              tone='green'
            />
            <KpiCard
              label='Unpaid leases'
              value={String(summary.unpaidLeases)}
              icon={<TriangleAlertIcon />}
              tone='amber'
            />
            <KpiCard
              label='Vacant units'
              value={String(summary.vacantUnits)}
              icon={<Building2Icon />}
              tone='red'
            />
            <KpiCard
              label='Rent collected'
              value={formatCents(summary.totalCollected)}
              icon={<WalletIcon />}
              tone='green'
            />
            <KpiCard
              label='Outstanding'
              value={formatCents(summary.outstanding)}
              icon={<BanknoteIcon />}
              tone='amber'
            />
          </div>

          {allRows.length === 0 ? (
            <Card className='py-8 text-center'>
              <CardHeader className='items-center'>
                <CardTitle>No matching rows</CardTitle>
                <CardDescription>No units match this status filter for this month.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
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
                                (r.tenantEmail || r.tenantPhone ? (
                                  <SendReminderButton
                                    tenantId={r.tenantId!}
                                    period={period}
                                    lastReminded={lastRemindedByTenant.get(r.tenantId!) ?? null}
                                  />
                                ) : (
                                  <span className='text-xs text-muted-foreground'>
                                    No email or phone
                                  </span>
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
                params={{ month: period, status: filter === 'all' ? undefined : filter }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
