import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { NewUnitForm } from './new-unit-form';

type Params = Promise<{ id: string }>;

export default async function NewUnitPage({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id } = await params;

  const property = await queryOne<{ id: string }>(
    'SELECT id FROM properties WHERE id = $1 AND user_id = $2',
    [id, session.user.id],
  );
  if (!property) notFound();

  return (
    <div className='mx-auto max-w-lg p-4 sm:p-8'>
      <h1 className='mb-6 text-2xl font-semibold tracking-tight'>Add Unit</h1>
      <NewUnitForm propertyId={property.id} />
    </div>
  );
}
