import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { PropertyList, type PropertyListItem } from '@/components/property-list';

export default async function Dashboard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const properties = await query<PropertyListItem>(
    `SELECT p.id, p.name, p.address, COUNT(u.id)::int as "unitCount"
     FROM properties p
     LEFT JOIN units u ON u.property_id = p.id AND u.archived_at IS NULL
     WHERE p.user_id = $1 AND p.archived_at IS NULL
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [session.user.id],
  );

  return (
    <div className='mx-auto max-w-6xl p-6 sm:p-8'>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>Properties</h1>
          <p className='text-sm text-muted-foreground'>
            {properties.length} {properties.length === 1 ? 'property' : 'properties'} in your
            portfolio
          </p>
        </div>
        <div className='flex gap-2'>
          {session.user.role === 'admin' && (
            <Button variant='outline' render={<Link href='/properties/archived' />}>
              Archived
            </Button>
          )}
          <Button render={<Link href='/properties/new' />}>New property</Button>
        </div>
      </div>

      <PropertyList properties={properties} />
    </div>
  );
}
