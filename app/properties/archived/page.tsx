import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { unarchiveProperty } from '../actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PAGE_SIZE, PaginationNav, clampPage, paginate } from '@/components/ui/pagination';

type SearchParams = Promise<{ page?: string }>;

interface ArchivedProperty {
  id: string;
  name: string;
  address: string;
  archived_at: string;
  ownerName: string;
}

export default async function ArchivedPropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  if (session.user.role !== 'admin') notFound();

  const { page: rawPage } = await searchParams;

  // Admin-only page: show archived properties across all users.
  const properties = await query<ArchivedProperty>(
    `SELECT p.id, p.name, p.address, p.archived_at, owner.name as "ownerName"
     FROM properties p
     JOIN "user" owner ON owner.id = p.user_id
     WHERE p.archived_at IS NOT NULL
     ORDER BY p.archived_at DESC`,
  );

  const totalPages = Math.ceil(properties.length / PAGE_SIZE);
  const page = clampPage(rawPage, totalPages);

  return (
    <div className='mx-auto max-w-4xl p-4 sm:p-8'>
      <Link
        href='/dashboard'
        className='mb-4 inline-block text-sm font-medium text-primary hover:underline'
      >
        &larr; Back to Properties
      </Link>

      <h1 className='mb-6 font-heading text-2xl font-semibold tracking-tight'>
        Archived Properties
      </h1>

      {properties.length === 0 ? (
        <Card className='py-8 text-center'>
          <CardHeader className='items-center'>
            <CardTitle>No archived properties</CardTitle>
            <CardDescription>Properties you archive will show up here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className='space-y-3'>
          {paginate(properties, page).map((property) => (
            <li key={property.id}>
              <Card>
                <CardContent className='flex items-center justify-between gap-4'>
                  <div>
                    <h2 className='font-semibold'>{property.name}</h2>
                    <p className='text-sm text-muted-foreground'>{property.address}</p>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      Archived {property.archived_at} · {property.ownerName}
                    </p>
                  </div>
                  <form action={unarchiveProperty}>
                    <input type='hidden' name='id' value={property.id} />
                    <Button type='submit' variant='outline' size='sm'>
                      Unarchive
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <PaginationNav page={page} totalPages={totalPages} basePath='/properties/archived' />
    </div>
  );
}
