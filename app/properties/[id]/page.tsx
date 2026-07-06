import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
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
    <div className='p-8 max-w-3xl mx-auto'>
      <Link href='/dashboard' className='text-blue-600 hover:underline mb-4 inline-block'>
        &larr; Back to Properties
      </Link>

      <div className='flex items-start justify-between mb-2'>
        <div>
          <h1 className='text-3xl font-bold'>{property.name}</h1>
          <p className='text-foreground/60'>{property.address}</p>
        </div>
        <PropertyActions propertyId={property.id} isAdmin={session.user.role === 'admin'} />
      </div>

      <div className='flex items-center justify-between mt-8 mb-4'>
        <h2 className='text-xl font-semibold'>Units</h2>
        <Link
          href={`/properties/${property.id}/units/new`}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700'
        >
          Add Unit
        </Link>
      </div>

      <UnitList propertyId={property.id} units={units} />

      <div className='mt-8 mb-8'>
        <h2 className='text-xl font-semibold mb-3'>Property Expenses</h2>
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
