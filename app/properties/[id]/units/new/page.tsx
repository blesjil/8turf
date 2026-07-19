import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { queryOne } from '@/lib/db';
import { NewUnitForm } from './new-unit-form';
import { PageContainer } from '@/components/page-container';

type Params = Promise<{ id: string }>;

export default async function NewUnitPage({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id } = await params;

  const property = await queryOne<{ id: string }>(
    'SELECT id FROM properties WHERE id = $1 AND ($2::text IS NULL OR user_id = $2)',
    [id, ownerScope(session)],
  );
  if (!property) notFound();

  return (
    <PageContainer>
      <div className='max-w-lg'>
        <h1 className='mb-6 font-heading text-2xl font-semibold tracking-tight'>Add Unit</h1>
        <NewUnitForm propertyId={property.id} />
      </div>
    </PageContainer>
  );
}
