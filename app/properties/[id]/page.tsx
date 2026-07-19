import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Building2Icon, DoorOpenIcon, UsersIcon, WalletIcon } from 'lucide-react';
import { auth } from '@/lib/auth';
import { isAdmin, ownerScope } from '@/lib/access';
import { query, queryOne } from '@/lib/db';
import { formatCents } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/kpi-card';
import { PageContainer } from '@/components/page-container';
import { PropertyActions } from './property-actions';
import { UnitList, type UnitListItem } from '@/components/unit-list';
import { ExpenseList, type Expense } from '@/components/expense-list';
import { recordPropertyExpense, updatePropertyExpense, deletePropertyExpense } from '../actions';
import { PAGE_SIZE, PaginationNav, clampPage, paginate } from '@/components/ui/pagination';

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ page?: string }>;

interface Property {
  id: string;
  name: string;
  address: string;
  ownerName: string | null;
}

export default async function PropertyDetail({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id } = await params;
  const { page: rawPage } = await searchParams;

  const property = await queryOne<Property>(
    `SELECT p.id, p.name, p.address, CASE WHEN $3 THEN owner.name END as "ownerName"
     FROM properties p
     JOIN "user" owner ON owner.id = p.user_id
     WHERE p.id = $1 AND ($2::text IS NULL OR p.user_id = $2)`,
    [id, ownerScope(session), isAdmin(session)],
  );
  if (!property) notFound();

  const units = await query<UnitListItem>(
    `SELECT u.id, u.unit_label, u.bedrooms, u.bathrooms, u.rent_amount as "rentAmount",
            t.name as "tenantName"
     FROM units u
     LEFT JOIN tenants t ON t.unit_id = u.id AND t.is_active
     WHERE u.property_id = $1 AND u.archived_at IS NULL
     ORDER BY u.created_at ASC`,
    [property.id],
  );

  const expenses = await query<Expense>(
    `SELECT id, category, amount, expense_date, remarks FROM expenses
     WHERE property_id = $1 AND unit_id IS NULL ORDER BY expense_date DESC`,
    [property.id],
  );

  const totalPages = Math.ceil(units.length / PAGE_SIZE);
  const page = clampPage(rawPage, totalPages);

  // Direct aggregates over the full (unpaginated) unit set — no invented metrics.
  const occupiedUnits = units.filter((u) => u.tenantName).length;
  const vacantUnits = units.length - occupiedUnits;
  const rentRoll = units.reduce((sum, u) => sum + u.rentAmount, 0);

  return (
    <PageContainer>
      <Link
        href='/dashboard'
        className='mb-4 inline-block text-sm font-medium text-primary hover:underline'
      >
        &larr; Back to Properties
      </Link>

      <div className='mb-8 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='font-heading text-3xl font-semibold tracking-tight'>{property.name}</h1>
          <p className='text-muted-foreground'>{property.address}</p>
          {property.ownerName && (
            <p className='mt-1 text-sm text-muted-foreground'>Owned by {property.ownerName}</p>
          )}
        </div>
        <PropertyActions propertyId={property.id} isAdmin={session.user.role === 'admin'} />
      </div>

      {units.length > 0 && (
        <div className='mb-8 grid grid-cols-2 gap-3.5 lg:grid-cols-4'>
          <KpiCard
            label='Units'
            value={String(units.length)}
            icon={<Building2Icon />}
            tone='blue'
          />
          <KpiCard
            label='Occupied'
            value={String(occupiedUnits)}
            icon={<UsersIcon />}
            tone='green'
          />
          <KpiCard
            label='Vacant'
            value={String(vacantUnits)}
            icon={<DoorOpenIcon />}
            tone='amber'
          />
          <KpiCard
            label='Rent roll'
            value={formatCents(rentRoll)}
            foot='asking, all units'
            icon={<WalletIcon />}
            tone='green'
          />
        </div>
      )}

      <div className='mb-4 flex items-center justify-between'>
        <h2 className='font-heading text-xl font-semibold tracking-tight'>Units</h2>
        <Button
          nativeButton={false}
          render={<Link href={`/properties/${property.id}/units/new`} />}
        >
          Add unit
        </Button>
      </div>

      <UnitList propertyId={property.id} units={paginate(units, page)} />
      <PaginationNav page={page} totalPages={totalPages} basePath={`/properties/${property.id}`} />

      <div className='mt-10'>
        <h2 className='mb-4 font-heading text-xl font-semibold tracking-tight'>
          Property Expenses
        </h2>
        <ExpenseList
          parentIdField='propertyId'
          parentId={property.id}
          expenses={expenses}
          recordAction={recordPropertyExpense}
          updateAction={updatePropertyExpense}
          deleteAction={deletePropertyExpense}
        />
      </div>
    </PageContainer>
  );
}
