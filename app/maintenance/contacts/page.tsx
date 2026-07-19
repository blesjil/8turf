import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdmin, ownerScope } from '@/lib/access';
import { query } from '@/lib/db';
import { MAINTENANCE_SERVICE_VALUES, type MaintenanceContact } from '@/lib/maintenance-contacts';
import { PageContainer } from '@/components/page-container';
import { PAGE_SIZE, clampPage, paginate } from '@/components/ui/pagination';
import { ContactDirectory, type ContactOwnerOption } from './contact-directory';

type SearchParams = Promise<{
  page?: string;
  q?: string;
  service?: string;
  preferred?: string;
  status?: string;
  owner?: string;
}>;

export default async function MaintenanceContactsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const admin = isAdmin(session);
  const scope = ownerScope(session);
  const raw = await searchParams;
  const q = raw.q?.trim().slice(0, 200) || undefined;
  const service = MAINTENANCE_SERVICE_VALUES.includes(raw.service as never)
    ? raw.service
    : undefined;
  const preferred = raw.preferred === 'true' ? 'true' : undefined;
  const status = raw.status === 'archived' ? 'archived' : 'active';

  const owners = admin
    ? await query<ContactOwnerOption>(
        'SELECT id, name, email FROM "user" ORDER BY lower(name), lower(email)',
      )
    : undefined;
  const owner =
    admin && raw.owner && owners?.some((candidate) => candidate.id === raw.owner)
      ? raw.owner
      : undefined;

  const params: unknown[] = [scope, owner ?? null, status === 'archived', preferred === 'true'];
  const conditions = [
    '($1::text IS NULL OR mc.user_id = $1)',
    '($2::text IS NULL OR mc.user_id = $2)',
    'CASE WHEN $3::boolean THEN mc.archived_at IS NOT NULL ELSE mc.archived_at IS NULL END',
    '($4::boolean = false OR mc.is_preferred)',
  ];

  if (service) {
    params.push(service);
    conditions.push(`mc.services @> ARRAY[$${params.length}]::text[]`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(
      mc.name ILIKE $${params.length}
      OR coalesce(mc.company, '') ILIKE $${params.length}
      OR coalesce(mc.phone, '') ILIKE $${params.length}
      OR coalesce(mc.email, '') ILIKE $${params.length}
      OR coalesce(mc.service_area, '') ILIKE $${params.length}
    )`);
  }

  const contacts = await query<MaintenanceContact>(
    `SELECT mc.*, owner.name AS owner_name
     FROM maintenance_contacts mc
     JOIN "user" owner ON owner.id = mc.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY mc.is_preferred DESC, lower(mc.name), mc.created_at DESC`,
    params,
  );

  const activeCountRows = await query<{ count: number }>(
    `SELECT count(*)::int AS count
     FROM maintenance_contacts mc
     WHERE ($1::text IS NULL OR mc.user_id = $1)
       AND ($2::text IS NULL OR mc.user_id = $2)
       AND mc.archived_at IS NULL`,
    [scope, owner ?? null],
  );

  const totalPages = Math.ceil(contacts.length / PAGE_SIZE);
  const page = clampPage(raw.page, totalPages);
  const filters = {
    q,
    service,
    preferred,
    status,
    owner,
  };

  return (
    <PageContainer>
      <ContactDirectory
        contacts={paginate(contacts, page)}
        owners={owners}
        currentUserId={session.user.id}
        activeCount={activeCountRows[0]?.count ?? 0}
        page={page}
        totalPages={totalPages}
        filters={filters}
      />
    </PageContainer>
  );
}
