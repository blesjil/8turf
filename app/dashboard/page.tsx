import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { format } from 'date-fns';
import { Building2Icon, TriangleAlertIcon, UsersIcon, WalletIcon } from 'lucide-react';
import { auth } from '@/lib/auth';
import { isAdmin, ownerScope } from '@/lib/access';
import { query } from '@/lib/db';
import { getPaymentsOverview } from '@/lib/payments-overview';
import { summarizePayments } from '@/lib/payments-summary';
import { computePaymentStatus } from '@/lib/payment-status';
import { formatCentsCompact } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { PropertyList, type PropertyListItem } from '@/components/property-list';
import { HealthStrip } from '@/components/health-strip';
import { KpiCard } from '@/components/kpi-card';
import { PageContainer } from '@/components/page-container';
import { PAGE_SIZE, PaginationNav, clampPage, paginate } from '@/components/ui/pagination';

type SearchParams = Promise<{ page?: string }>;

type BaseProperty = Omit<
  PropertyListItem,
  'collected' | 'occupied' | 'unpaidUnits' | 'partialUnits'
>;

export default async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { page: rawPage } = await searchParams;

  const admin = isAdmin(session);
  const scope = ownerScope(session);
  const period = format(new Date(), 'yyyy-MM');

  const [baseProperties, overview] = await Promise.all([
    query<BaseProperty>(
      `SELECT p.id, p.name, p.address, COUNT(un.id)::int as "unitCount",
              CASE WHEN $2 THEN owner.name END as "ownerName"
       FROM properties p
       JOIN "user" owner ON owner.id = p.user_id
       LEFT JOIN units un ON un.property_id = p.id AND un.archived_at IS NULL
       WHERE ($1::text IS NULL OR p.user_id = $1) AND p.archived_at IS NULL
       GROUP BY p.id, owner.name
       ORDER BY p.created_at DESC`,
      [scope, admin],
    ),
    getPaymentsOverview(period, scope),
  ]);

  const { activeRows, inactiveRows, paidByTenant } = overview;
  const summary = summarizePayments(activeRows, inactiveRows, paidByTenant);

  // Per-property aggregates from the same month-of math the Payments page uses.
  type Agg = { collected: number; occupied: number; unpaidUnits: number; partialUnits: number };
  const byProperty = new Map<string, Agg>();
  const health = { paid: 0, partial: 0, unpaid: 0, vacant: inactiveRows.length };
  for (const r of activeRows) {
    const agg =
      byProperty.get(r.propertyId) ??
      byProperty
        .set(r.propertyId, { collected: 0, occupied: 0, unpaidUnits: 0, partialUnits: 0 })
        .get(r.propertyId)!;
    const rent = r.rentAmount ?? 0;
    const paid = paidByTenant.get(r.tenantId!) ?? 0;
    agg.collected += Math.min(paid, rent);
    agg.occupied += 1;
    const status = computePaymentStatus(paid, rent);
    health[status] += 1;
    if (status === 'unpaid') agg.unpaidUnits += 1;
    else if (status === 'partial') agg.partialUnits += 1;
  }

  const properties: PropertyListItem[] = baseProperties.map((p) => {
    const agg = byProperty.get(p.id);
    return {
      ...p,
      collected: agg?.collected ?? 0,
      occupied: agg?.occupied ?? 0,
      unpaidUnits: agg?.unpaidUnits ?? 0,
      partialUnits: agg?.partialUnits ?? 0,
    };
  });

  const totalUnits = summary.activeLeases + summary.vacantUnits;
  const occupancyPct = totalUnits > 0 ? Math.round((summary.activeLeases / totalUnits) * 100) : 0;

  const totalPages = Math.ceil(properties.length / PAGE_SIZE);
  const page = clampPage(rawPage, totalPages);

  return (
    <PageContainer>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='font-heading text-2xl font-semibold tracking-tight'>Portfolio</h1>
          <p className='text-sm text-muted-foreground'>
            {properties.length} {properties.length === 1 ? 'property' : 'properties'} · {totalUnits}{' '}
            {totalUnits === 1 ? 'unit' : 'units'} · {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>
        <div className='flex gap-2'>
          {session.user.role === 'admin' && (
            <Button
              variant='outline'
              nativeButton={false}
              render={<Link href='/properties/archived' />}
            >
              Archived
            </Button>
          )}
          <Button nativeButton={false} render={<Link href='/properties/new' />}>
            New property
          </Button>
        </div>
      </div>

      <HealthStrip counts={health} />

      <section className='mt-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4'>
        <KpiCard
          label='Rent collected'
          value={formatCentsCompact(summary.totalCollected)}
          foot={`this month · ${format(new Date(), 'MMM yyyy')}`}
          icon={<WalletIcon />}
          tone='green'
        />
        <KpiCard
          label='Occupancy'
          value={`${occupancyPct}%`}
          foot={`${summary.activeLeases} of ${totalUnits} units occupied`}
          icon={<Building2Icon />}
          tone='blue'
        />
        <KpiCard
          label='Outstanding'
          value={formatCentsCompact(summary.outstanding)}
          foot={`${summary.unpaidLeases} ${summary.unpaidLeases === 1 ? 'unit' : 'units'} pending`}
          icon={<TriangleAlertIcon />}
          tone='amber'
        />
        <KpiCard
          label='Vacant units'
          value={String(summary.vacantUnits)}
          foot={`of ${totalUnits} total units`}
          icon={<UsersIcon />}
          tone='red'
        />
      </section>

      <h2 className='mt-8 mb-3 font-heading text-[17px] font-semibold'>Properties</h2>

      <PropertyList properties={paginate(properties, page)} />
      <PaginationNav page={page} totalPages={totalPages} basePath='/dashboard' />
    </PageContainer>
  );
}
