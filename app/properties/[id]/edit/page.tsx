import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { EditPropertyForm } from './edit-property-form';

type Params = Promise<{ id: string }>;

export default async function EditPropertyPage({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id } = await params;

  const property = await queryOne<{ id: string; name: string; address: string }>(
    'SELECT id, name, address FROM properties WHERE id = $1 AND user_id = $2',
    [id, session.user.id],
  );
  if (!property) notFound();

  return (
    <div className='mx-auto max-w-lg p-6 sm:p-8'>
      <h1 className='mb-6 text-2xl font-semibold tracking-tight'>Edit Property</h1>
      <EditPropertyForm id={property.id} name={property.name} address={property.address} />
    </div>
  );
}
