import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Building2Icon,
  DoorClosedIcon,
  DoorOpenIcon,
  PercentIcon,
  ReceiptIcon,
  WalletIcon,
  BanknoteIcon,
  TrendingUpIcon,
  HourglassIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { formatCents } from '@/lib/money';
import { getPaymentsOverview } from '@/lib/payments-overview';
import { deriveCharges } from '@/lib/reports/charges';
import { fetchCoveringPayments, fetchLeases } from '@/lib/reports/data';
import { monthBounds } from '@/lib/reports/period';
import { summarizeBilling } from '@/lib/reports/billing';
import { fetchCollections, summarizeCollections } from '@/lib/reports/collections';
import { PageContainer } from '@/components/page-container';
import { ReportsNav } from '@/components/reports/reports-nav';
import { ReportHeader } from '@/components/reports/report-header';
import { ReportFilters } from '@/components/reports/report-filters';
import { KpiCard } from '@/components/kpi-card';

type SearchParams = Promise<{ month?: string }>;

export default async function ReportsDashboardPage({
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
  const today = format(new Date(), 'yyyy-MM-dd');
  const { start, endExclusive } = monthBounds(period);

  const [overview, leases, coveringPayments, collectionRows] = await Promise.all([
    getPaymentsOverview(period, scope),
    fetchLeases(scope),
    fetchCoveringPayments(scope, start, endExclusive),
    fetchCollections(scope, start, endExclusive),
  ]);

  const billing = summarizeBilling(deriveCharges(leases, coveringPayments, [period], today));
  const collections = summarizeCollections(collectionRows);

  const occupied = overview.activeRows.length;
  const vacant = overview.inactiveRows.length;
  const totalUnits = occupied + vacant;
  const occupancyRate = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;
  const collectionRate =
    billing.totalDue > 0 ? Math.round((billing.amountPaid / billing.totalDue) * 100) : 0;

  // Each KPI links to the report it summarises, so the numbers always reconcile.
  const kpis = [
    {
      href: '/reports/occupancy',
      label: 'Total units',
      value: String(totalUnits),
      icon: <Building2Icon />,
      tone: 'blue' as const,
    },
    {
      href: '/reports/occupancy',
      label: 'Occupied',
      value: String(occupied),
      icon: <DoorClosedIcon />,
      tone: 'green' as const,
    },
    {
      href: '/reports/occupancy',
      label: 'Vacant',
      value: String(vacant),
      icon: <DoorOpenIcon />,
      tone: 'red' as const,
    },
    {
      href: '/reports/occupancy',
      label: 'Occupancy rate',
      value: `${occupancyRate}%`,
      icon: <PercentIcon />,
      tone: 'blue' as const,
    },
    {
      href: '/reports/billing',
      label: 'Total rent due',
      value: formatCents(billing.totalDue),
      icon: <ReceiptIcon />,
      tone: 'green' as const,
    },
    {
      href: '/reports/collections',
      label: 'Total collected',
      value: formatCents(collections.totalCollected),
      icon: <WalletIcon />,
      tone: 'green' as const,
    },
    {
      href: '/reports/outstanding',
      label: 'Total outstanding',
      value: formatCents(billing.amountOutstanding),
      icon: <BanknoteIcon />,
      tone: 'amber' as const,
    },
    {
      href: '/reports/billing',
      label: 'Collection rate',
      value: `${collectionRate}%`,
      icon: <TrendingUpIcon />,
      tone: 'blue' as const,
    },
    {
      href: '/reports/collections',
      label: 'Advance payments',
      value: String(collections.advance),
      icon: <HourglassIcon />,
      tone: 'blue' as const,
    },
    {
      href: '/reports/outstanding',
      label: 'Overdue accounts',
      value: String(billing.overdue),
      icon: <TriangleAlertIcon />,
      tone: 'red' as const,
    },
  ];

  return (
    <PageContainer>
      <ReportsNav />
      <ReportHeader
        title='Reports Dashboard'
        period={period}
        dateBasis='Mixed (per KPI)'
        action={<ReportFilters basePath='/reports' month={period} />}
      />

      <div className='grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5'>
        {kpis.map((k, i) => (
          <Link
            key={`${k.href}-${i}`}
            href={k.href}
            className='rounded-xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
          >
            <KpiCard label={k.label} value={k.value} icon={k.icon} tone={k.tone} />
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
