import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { format } from 'date-fns';
import Link from 'next/link';
import { WalletIcon, BanknoteIcon, ClockIcon, HourglassIcon } from 'lucide-react';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { monthBounds } from '@/lib/reports/period';
import { classifyPayment, fetchCollections, summarizeCollections } from '@/lib/reports/collections';
import { PageContainer } from '@/components/page-container';
import { ReportsNav } from '@/components/reports/reports-nav';
import { ReportHeader } from '@/components/reports/report-header';
import { ReportFilters } from '@/components/reports/report-filters';
import { KpiCard } from '@/components/kpi-card';
import { Badge } from '@/components/ui/badge';
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

const CLASS_LABELS = { advance: 'Advance', on_time: 'On time', late: 'Late' } as const;
const CLASS_VARIANTS = { advance: 'secondary', on_time: 'success', late: 'destructive' } as const;

export default async function CollectionsReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  if (session.user.role !== 'admin') notFound();

  const scope = ownerScope(session);
  const { month } = await searchParams;
  const period = month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), 'yyyy-MM');
  const { start, endExclusive } = monthBounds(period);

  const rows = await fetchCollections(scope, start, endExclusive);
  const summary = summarizeCollections(rows);

  return (
    <PageContainer>
      <ReportsNav />
      <ReportHeader
        title='Monthly Collections Report'
        period={period}
        dateBasis='Payment date'
        action={<ReportFilters basePath='/reports/collections' month={period} />}
      />

      {rows.length === 0 ? (
        <Card className='py-8 text-center'>
          <CardHeader className='items-center'>
            <CardTitle>No payments this month</CardTitle>
            <CardDescription>No payments were received in the selected month.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='flex flex-col gap-8'>
          <div className='grid grid-cols-2 gap-3.5 lg:grid-cols-4'>
            <KpiCard
              label='Total collected'
              value={formatCents(summary.totalCollected)}
              icon={<WalletIcon />}
              tone='green'
              foot={`${summary.totalPayments} payments`}
            />
            <KpiCard
              label='Advance payments'
              value={String(summary.advance)}
              icon={<HourglassIcon />}
              tone='blue'
            />
            <KpiCard
              label='Late payments'
              value={String(summary.late)}
              icon={<ClockIcon />}
              tone='amber'
            />
            <KpiCard
              label='Methods'
              value={String(summary.byMethod.length)}
              icon={<BanknoteIcon />}
              foot={summary.byMethod.map((m) => m.method).join(', ') || '—'}
            />
          </div>

          <Card className='py-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paid date</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className='text-right'>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Classification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const cls = classifyPayment(r);
                    return (
                      <TableRow key={r.paymentId}>
                        <TableCell>{formatDate(r.paidDate)}</TableCell>
                        <TableCell>{r.tenantName}</TableCell>
                        <TableCell>
                          <Link
                            href={`/properties/${r.propertyId}/units/${r.unitId}`}
                            className='font-mono font-medium text-primary hover:underline'
                          >
                            {r.unitLabel}
                          </Link>
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {formatCents(r.amount)}
                        </TableCell>
                        <TableCell className='capitalize'>{r.method || '—'}</TableCell>
                        <TableCell className='text-muted-foreground'>
                          {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={CLASS_VARIANTS[cls]}>{CLASS_LABELS[cls]}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
