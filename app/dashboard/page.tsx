import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { PropertyList, type PropertyListItem } from '@/components/property-list';

export default async function Dashboard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const properties = db
    .query<PropertyListItem, [string]>(
      `SELECT p.id, p.name, p.address, COUNT(u.id) as unitCount
       FROM properties p
       LEFT JOIN units u ON u.property_id = p.id AND u.archived_at IS NULL
       WHERE p.user_id = ? AND p.archived_at IS NULL
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
    )
    .all(session.user.id);

  return (
    <div className='p-8'>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold'>Properties</h1>
        <div className='flex gap-3'>
          <Link
            href='/payments'
            className='px-4 py-2 border border-border rounded-lg hover:bg-foreground/5'
          >
            Payments Overview
          </Link>
          <Link
            href='/properties/new'
            className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700'
          >
            New Property
          </Link>
        </div>
      </div>

      <PropertyList properties={properties} />
    </div>
  );
}
