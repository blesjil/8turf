import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/access';
import { query } from '@/lib/db';
import { NewPropertyForm, type OwnerOption } from './new-property-form';

export default async function NewPropertyPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  // Admins can create a property on behalf of any user.
  const owners = isAdmin(session)
    ? await query<OwnerOption>('SELECT id, name, email FROM "user" ORDER BY name')
    : undefined;

  return (
    <div className='mx-auto max-w-lg p-4 sm:p-8'>
      <h1 className='mb-6 font-heading text-2xl font-semibold tracking-tight'>New Property</h1>
      <NewPropertyForm owners={owners} currentUserId={session.user.id} />
    </div>
  );
}
