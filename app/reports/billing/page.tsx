import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { format } from 'date-fns';
import Link from 'next/link';
import { ReceiptIcon, WalletIcon, BanknoteIcon, TriangleAlertIcon } from 'lucide-react';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { deriveCharges } from '@/lib/reports/charges';
import { fetchCoveringPayments, fetchLeases } from '@/lib/reports/data';
import { monthBounds } from '@/lib/reports/period';
import { summarizeBilling } from '@/lib/reports/billing';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SearchParams = Promise<{ month?: string }>;

export default async function BillingReportPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  if (session.user.role !== 'admin') notFound();

  const scope = ownerScope(session);
  const { month } = await searchParams;
  const period = month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), 'yyyy-MM');
  const today = format(new Date(), 'yyyy-MM-dd');
  const { start, endExclusive } = monthBounds(period);

  const [leases, payments] = await Promise.all([
    fetchLeases(scope),
    fetchCoveringPayments(scope, start, endExclusive),
  ]);
  const charges = deriveCharges(leases, payments, [period], today);
  const summary = summarizeBilling(charges);

  return (
    <PageContainer>
      <ReportsNav />
      <ReportHeader
        title='Monthly Billing Report'
        period={period}
        dateBasis='Due date'
        action={<ReportFilters basePath='/reports/billing' month={period} />}
      />

      {charges.length === 0 ? (
        <Card className='py-8 text-center'>
          <CardHeader className='items-center'>
            <CardTitle>No rent due this month</CardTitle>
            <CardDescription>No active leases cover the selected month.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='flex flex-col gap-8'>
          <div className='grid grid-cols-2 gap-3.5 lg:grid-cols-4'>
            <KpiCard
              label='Total due'
              value={formatCents(summary.totalDue)}
              icon={<ReceiptIcon />}
            />
            <KpiCard
              label='Amount paid'
              value={formatCents(summary.amountPaid)}
              icon={<WalletIcon />}
              tone='green'
            />
            <KpiCard
              label='Outstanding'
              value={formatCents(summary.amountOutstanding)}
              icon={<BanknoteIcon />}
              tone='amber'
            />
            <KpiCard
              label='Overdue bills'
              value={String(summary.overdue)}
              icon={<TriangleAlertIcon />}
              tone='red'
            />
          </div>

          <Card className='py-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='hidden md:table-cell'>Property</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className='text-right'>Rent due</TableHead>
                    <TableHead className='text-right'>Paid</TableHead>
                    <TableHead className='text-right'>Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.map((c) => (
                    <TableRow key={`${c.unitId}-${c.tenantId}-${c.period}`}>
                      <TableCell className='hidden md:table-cell'>{c.propertyName}</TableCell>
                      <TableCell>
                        <Link
                          href={`/properties/${c.propertyId}/units/${c.unitId}`}
                          className='font-mono font-medium text-primary hover:underline'
                        >
                          {c.unitLabel}
                        </Link>
                      </TableCell>
                      <TableCell>{c.tenantName}</TableCell>
                      <TableCell>{formatDate(c.dueDate)}</TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {formatCents(c.amount)}
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {formatCents(Math.min(c.creditsApplied, c.amount))}
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {formatCents(c.outstanding)}
                      </TableCell>
                      <TableCell>
                        <ChargeStatusBadge status={c.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className='hidden md:table-cell' />
                    <TableCell colSpan={2}>{summary.totalBills} bills</TableCell>
                    <TableCell />
                    <TableCell className='text-right font-mono tabular-nums'>
                      {formatCents(summary.totalDue)}
                    </TableCell>
                    <TableCell className='text-right font-mono tabular-nums'>
                      {formatCents(summary.amountPaid)}
                    </TableCell>
                    <TableCell className='text-right font-mono tabular-nums'>
                      {formatCents(summary.amountOutstanding)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
