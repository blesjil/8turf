import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NewUnitForm } from './new-unit-form';

type Params = Promise<{ id: string }>;

export default async function NewUnitPage({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id } = await params;

  const property = db
    .query<{ id: string }, [string, string]>(
      'SELECT id FROM properties WHERE id = ? AND user_id = ?',
    )
    .get(id, session.user.id);
  if (!property) notFound();

  return (
    <div className='p-8 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Add Unit</h1>
      <NewUnitForm propertyId={property.id} />
    </div>
  );
}
