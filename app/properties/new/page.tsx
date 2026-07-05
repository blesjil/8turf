import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { NewPropertyForm } from './new-property-form';

export default async function NewPropertyPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  return (
    <div className='p-8 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>New Property</h1>
      <NewPropertyForm />
    </div>
  );
}
