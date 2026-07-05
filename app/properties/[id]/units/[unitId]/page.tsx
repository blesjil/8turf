import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatCents } from '@/lib/money';
import { UnitActions } from './unit-actions';

type Params = Promise<{ id: string; unitId: string }>;

interface Unit {
  id: string;
  property_id: string;
  unit_label: string;
  bedrooms: number;
  bathrooms: number;
  rent_amount: number;
}

export default async function UnitDetail({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id, unitId } = await params;

  const unit = db
    .query<Unit, [string, string, string]>(
      `SELECT u.id, u.property_id, u.unit_label, u.bedrooms, u.bathrooms, u.rent_amount
       FROM units u
       JOIN properties p ON p.id = u.property_id
       WHERE u.id = ? AND u.property_id = ? AND p.user_id = ?`,
    )
    .get(unitId, id, session.user.id);
  if (!unit) notFound();

  return (
    <div className='p-8 max-w-3xl mx-auto'>
      <Link
        href={`/properties/${unit.property_id}`}
        className='text-blue-600 hover:underline mb-4 inline-block'
      >
        &larr; Back to Property
      </Link>

      <div className='flex items-start justify-between mb-6'>
        <div>
          <h1 className='text-3xl font-bold'>{unit.unit_label}</h1>
          <p className='text-foreground/60'>
            {unit.bedrooms} bd / {unit.bathrooms} ba &middot; {formatCents(unit.rent_amount)}/mo
            asking
          </p>
        </div>
        <UnitActions propertyId={unit.property_id} unitId={unit.id} />
      </div>
    </div>
  );
}
