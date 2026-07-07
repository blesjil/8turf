import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { PropertyList, type PropertyListItem } from '@/components/property-list';
import { PAGE_SIZE, PaginationNav, clampPage, paginate } from '@/components/ui/pagination';

type SearchParams = Promise<{ page?: string }>;

export default async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { page: rawPage } = await searchParams;

  const properties = await query<PropertyListItem>(
    `SELECT p.id, p.name, p.address, COUNT(u.id)::int as "unitCount"
     FROM properties p
     LEFT JOIN units u ON u.property_id = p.id AND u.archived_at IS NULL
     WHERE p.user_id = $1 AND p.archived_at IS NULL
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [session.user.id],
  );

  const totalPages = Math.ceil(properties.length / PAGE_SIZE);
  const page = clampPage(rawPage, totalPages);

  return (
    <div className='mx-auto max-w-6xl p-4 sm:p-8'>
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
            <Button
              variant='outline'
              nativeButton={false}
              render={<Link href='/properties/archived' />}
            >
              Archived
            </Button>
          )}
          <Button nativeButton={false} render={<Link href='/properties/new' />}>
            New property
          </Button>
        </div>
      </div>

      <PropertyList properties={paginate(properties, page)} />
      <PaginationNav page={page} totalPages={totalPages} basePath='/dashboard' />
    </div>
  );
}
