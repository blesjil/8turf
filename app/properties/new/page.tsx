import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { NewPropertyForm } from './new-property-form';

export default async function NewPropertyPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  return (
    <div className='mx-auto max-w-lg p-6 sm:p-8'>
      <h1 className='mb-6 text-2xl font-semibold tracking-tight'>New Property</h1>
      <NewPropertyForm />
    </div>
  );
}
