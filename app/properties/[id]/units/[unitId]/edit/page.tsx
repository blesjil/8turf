import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { EditUnitForm } from './edit-unit-form';

type Params = Promise<{ id: string; unitId: string }>;

interface Unit {
  id: string;
  unit_label: string;
  bedrooms: number;
  bathrooms: number;
  rent_amount: number;
}

export default async function EditUnitPage({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id, unitId } = await params;

  const unit = db
    .query<Unit, [string, string, string]>(
      `SELECT u.id, u.unit_label, u.bedrooms, u.bathrooms, u.rent_amount
       FROM units u
       JOIN properties p ON p.id = u.property_id
       WHERE u.id = ? AND u.property_id = ? AND p.user_id = ?`,
    )
    .get(unitId, id, session.user.id);
  if (!unit) notFound();

  return (
    <div className='p-8 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Edit Unit</h1>
      <EditUnitForm
        id={unit.id}
        unitLabel={unit.unit_label}
        bedrooms={unit.bedrooms}
        bathrooms={unit.bathrooms}
        rentAmount={unit.rent_amount}
      />
    </div>
  );
}
