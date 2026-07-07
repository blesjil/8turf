import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { CreateUserForm } from './create-user-form';
import { PromoteButton } from './promote-button';
import { ResetPasswordButton } from './reset-password-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PAGE_SIZE, PaginationNav, clampPage, paginate } from '@/components/ui/pagination';

type SearchParams = Promise<{ page?: string }>;

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: string;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/authenticate');
  }
  if (session.user.role !== 'admin') {
    notFound();
  }

  const { page: rawPage } = await searchParams;

  const users = await query<UserRow>(
    'SELECT id, name, email, role, "createdAt" FROM "user" ORDER BY "createdAt" DESC',
  );

  const totalPages = Math.ceil(users.length / PAGE_SIZE);
  const page = clampPage(rawPage, totalPages);

  return (
    <div className='mx-auto max-w-4xl space-y-8 p-4 sm:p-8'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>Manage Users</h1>
        <p className='text-sm text-muted-foreground'>
          Create accounts, grant admin access, and reset passwords.
        </p>
      </div>

      <CreateUserForm />

      <Card className='py-0'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginate(users, page).map((user) => (
                <TableRow key={user.id}>
                  <TableCell className='font-medium'>{user.name}</TableCell>
                  <TableCell className='text-muted-foreground'>{user.email}</TableCell>
                  <TableCell>
                    {user.role === 'admin' ? (
                      <Badge>Admin</Badge>
                    ) : (
                      <Badge variant='outline'>User</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center justify-end gap-2'>
                      {user.role !== 'admin' && <PromoteButton userId={user.id} />}
                      <ResetPasswordButton userId={user.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <PaginationNav page={page} totalPages={totalPages} basePath='/admin/users' />
    </div>
  );
}
