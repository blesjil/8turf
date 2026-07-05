import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatCents } from '@/lib/money';
import { UnitActions } from './unit-actions';
import { TenantCard, type Tenant } from '@/components/tenant-card';

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

  const activeTenant =
    db
      .query<Tenant, [string]>(
        `SELECT id, name, email, phone, rent_amount, lease_start_date, lease_end_date, is_active
       FROM tenants WHERE unit_id = ? AND is_active = 1`,
      )
      .get(unit.id) ?? null;

  const tenantHistory = db
    .query<Tenant, [string]>(
      `SELECT id, name, email, phone, rent_amount, lease_start_date, lease_end_date, is_active
       FROM tenants WHERE unit_id = ? ORDER BY lease_start_date DESC`,
    )
    .all(unit.id);

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

      <div className='mb-8'>
        <h2 className='text-xl font-semibold mb-3'>Current Tenant</h2>
        <TenantCard unitId={unit.id} tenant={activeTenant} />
      </div>

      {tenantHistory.length > 0 && (
        <div className='mb-8'>
          <h2 className='text-xl font-semibold mb-3'>Tenancy History</h2>
          <ul className='space-y-2'>
            {tenantHistory.map((t) => (
              <li key={t.id} className='text-sm text-foreground/60 border-b border-border/50 pb-2'>
                {t.name} &middot; {t.lease_start_date} to {t.lease_end_date || 'ongoing'}
                {t.is_active === 1 && <span className='ml-2 text-green-600'>(current)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
