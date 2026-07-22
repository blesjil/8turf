import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { format } from 'date-fns';
import Link from 'next/link';
import { Building2Icon, DoorOpenIcon, DoorClosedIcon, PercentIcon } from 'lucide-react';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { getPaymentsOverview } from '@/lib/payments-overview';
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

export default async function OccupancyReportPage({
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

  const { activeRows, inactiveRows } = await getPaymentsOverview(period, scope);
  const rows = [
    ...activeRows.map((r) => ({ ...r, occupied: true })),
    ...inactiveRows.map((r) => ({ ...r, occupied: false })),
  ].sort(
    (a, b) =>
      a.propertyName.localeCompare(b.propertyName) || a.unitLabel.localeCompare(b.unitLabel),
  );

  const totalUnits = rows.length;
  const occupied = activeRows.length;
  const vacant = inactiveRows.length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;

  return (
    <PageContainer>
      <ReportsNav />
      <ReportHeader
        title='Occupancy Report'
        period={period}
        dateBasis='Lease period overlap'
        action={<ReportFilters basePath='/reports/occupancy' month={period} />}
      />

      {totalUnits === 0 ? (
        <Card className='py-8 text-center'>
          <CardHeader className='items-center'>
            <CardTitle>No units yet</CardTitle>
            <CardDescription>Add a property with units to track occupancy.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='flex flex-col gap-8'>
          <div className='grid grid-cols-2 gap-3.5 lg:grid-cols-4'>
            <KpiCard label='Total units' value={String(totalUnits)} icon={<Building2Icon />} />
            <KpiCard
              label='Occupied'
              value={String(occupied)}
              icon={<DoorClosedIcon />}
              tone='green'
            />
            <KpiCard label='Vacant' value={String(vacant)} icon={<DoorOpenIcon />} tone='red' />
            <KpiCard
              label='Occupancy rate'
              value={`${occupancyRate}%`}
              icon={<PercentIcon />}
              tone='blue'
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
                    <TableHead>Lease start</TableHead>
                    <TableHead>Lease end</TableHead>
                    <TableHead className='text-right'>Monthly rent</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.unitId}>
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
                      <TableCell>{r.leaseStartDate ? formatDate(r.leaseStartDate) : '—'}</TableCell>
                      <TableCell>{r.leaseEndDate ? formatDate(r.leaseEndDate) : '—'}</TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {r.rentAmount !== null ? formatCents(r.rentAmount) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.occupied ? 'success' : 'neutral'}>
                          {r.occupied ? 'Occupied' : 'Vacant'}
                        </Badge>
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
