import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { unarchiveProperty } from '../actions';

interface ArchivedProperty {
  id: string;
  name: string;
  address: string;
  archived_at: string;
}

export default async function ArchivedPropertiesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  if (session.user.role !== 'admin') notFound();

  const properties = await query<ArchivedProperty>(
    `SELECT id, name, address, archived_at FROM properties
     WHERE user_id = $1 AND archived_at IS NOT NULL
     ORDER BY archived_at DESC`,
    [session.user.id],
  );

  return (
    <div className='p-8 max-w-3xl mx-auto'>
      <Link href='/dashboard' className='text-blue-600 hover:underline mb-4 inline-block'>
        &larr; Back to Properties
      </Link>

      <h1 className='text-2xl font-bold mb-6'>Archived Properties</h1>

      {properties.length === 0 ? (
        <p className='text-foreground/60'>No archived properties.</p>
      ) : (
        <ul className='space-y-3'>
          {properties.map((property) => (
            <li
              key={property.id}
              className='flex items-center justify-between p-4 border border-border rounded-lg'
            >
              <div>
                <h2 className='font-semibold'>{property.name}</h2>
                <p className='text-sm text-foreground/60'>{property.address}</p>
                <p className='text-xs text-foreground/40 mt-1'>Archived {property.archived_at}</p>
              </div>
              <form action={unarchiveProperty}>
                <input type='hidden' name='id' value={property.id} />
                <button
                  type='submit'
                  className='text-sm text-blue-600 hover:text-blue-800 cursor-pointer'
                >
                  Unarchive
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
