import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { format } from 'date-fns';
import Link from 'next/link';
import { BanknoteIcon, UsersIcon, ClockIcon, CircleDollarSignIcon } from 'lucide-react';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { deriveCharges } from '@/lib/reports/charges';
import { fetchCoveringPayments, fetchLeases } from '@/lib/reports/data';
import { monthBounds } from '@/lib/reports/period';
import { buildOutstanding, summarizeOutstanding } from '@/lib/reports/outstanding';
import { PageContainer } from '@/components/page-container';
import { ReportsNav } from '@/components/reports/reports-nav';
import { ReportHeader } from '@/components/reports/report-header';
import { ReportFilters } from '@/components/reports/report-filters';
import { ChargeStatusBadge } from '@/components/reports/charge-status-badge';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SearchParams = Promise<{ month?: string; asOf?: string }>;

export default async function OutstandingReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  if (session.user.role !== 'admin') notFound();

  const scope = ownerScope(session);
  const { month, asOf: rawAsOf } = await searchParams;
  const period = month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), 'yyyy-MM');
  const asOf =
    rawAsOf && /^\d{4}-\d{2}-\d{2}$/.test(rawAsOf) ? rawAsOf : format(new Date(), 'yyyy-MM-dd');
  const { start, endExclusive } = monthBounds(period);

  const [leases, payments] = await Promise.all([
    fetchLeases(scope),
    fetchCoveringPayments(scope, start, endExclusive),
  ]);
  const charges = deriveCharges(leases, payments, [period], asOf);
  const rows = buildOutstanding(charges, asOf);
  const summary = summarizeOutstanding(rows);

  return (
    <PageContainer>
      <ReportsNav />
      <ReportHeader
        title='Outstanding Rent Report'
        period={period}
        dateBasis='Due date'
        asOf={asOf}
        action={
          <ReportFilters basePath='/reports/outstanding' month={period} asOf={asOf} showAsOf />
        }
      />

      {rows.length === 0 ? (
        <Card className='py-8 text-center'>
          <CardHeader className='items-center'>
            <CardTitle>Nothing outstanding</CardTitle>
            <CardDescription>All rent for this month is settled as of this date.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='flex flex-col gap-8'>
          <div className='grid grid-cols-2 gap-3.5 lg:grid-cols-4'>
            <KpiCard
              label='Total outstanding'
              value={formatCents(summary.totalOutstanding)}
              icon={<BanknoteIcon />}
              tone='amber'
            />
            <KpiCard
              label='Overdue'
              value={formatCents(summary.overdueOutstanding)}
              icon={<ClockIcon />}
              tone='red'
            />
            <KpiCard
              label='Current'
              value={formatCents(summary.currentOutstanding)}
              icon={<CircleDollarSignIcon />}
            />
            <KpiCard
              label='Tenants with balance'
              value={String(summary.tenantsWithBalance)}
              icon={<UsersIcon />}
              tone='blue'
            />
          </div>

          <Card className='py-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className='text-right'>Original</TableHead>
                    <TableHead className='text-right'>Paid</TableHead>
                    <TableHead className='text-right'>Outstanding</TableHead>
                    <TableHead className='text-right'>Days overdue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={`${r.unitId}-${r.tenantId}-${r.period}`}>
                      <TableCell>
                        <Link
                          href={`/properties/${r.propertyId}/units/${r.unitId}`}
                          className='font-mono font-medium text-primary hover:underline'
                        >
                          {r.unitLabel}
                        </Link>
                      </TableCell>
                      <TableCell>{r.tenantName}</TableCell>
                      <TableCell>{formatDate(r.dueDate)}</TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {formatCents(r.amount)}
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {formatCents(Math.min(r.creditsApplied, r.amount))}
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {formatCents(r.outstanding)}
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {r.daysOverdue > 0 ? r.daysOverdue : '—'}
                      </TableCell>
                      <TableCell>
                        <ChargeStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {r.lastPaymentDate ? formatDate(r.lastPaymentDate) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
