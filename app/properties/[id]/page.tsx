import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { PropertyActions } from './property-actions';
import { UnitList, type UnitListItem } from '@/components/unit-list';
import { ExpenseList, type Expense } from '@/components/expense-list';
import { recordPropertyExpense, updatePropertyExpense, deletePropertyExpense } from '../actions';

type Params = Promise<{ id: string }>;

interface Property {
  id: string;
  name: string;
  address: string;
}

export default async function PropertyDetail({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id } = await params;

  const property = await queryOne<Property>(
    'SELECT id, name, address FROM properties WHERE id = $1 AND user_id = $2',
    [id, session.user.id],
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

  return (
    <div className='mx-auto max-w-4xl p-6 sm:p-8'>
      <Link
        href='/dashboard'
        className='mb-4 inline-block text-sm font-medium text-primary hover:underline'
      >
        &larr; Back to Properties
      </Link>

      <div className='mb-8 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-3xl font-semibold tracking-tight'>{property.name}</h1>
          <p className='text-muted-foreground'>{property.address}</p>
        </div>
        <PropertyActions propertyId={property.id} isAdmin={session.user.role === 'admin'} />
      </div>

      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-xl font-semibold tracking-tight'>Units</h2>
        <Button
          nativeButton={false}
          render={<Link href={`/properties/${property.id}/units/new`} />}
        >
          Add unit
        </Button>
      </div>

      <UnitList propertyId={property.id} units={units} />

      <div className='mt-10'>
        <h2 className='mb-4 text-xl font-semibold tracking-tight'>Property Expenses</h2>
        <ExpenseList
          parentIdField='propertyId'
          parentId={property.id}
          expenses={expenses}
          recordAction={recordPropertyExpense}
          updateAction={updatePropertyExpense}
          deleteAction={deletePropertyExpense}
        />
      </div>
    </div>
  );
}
