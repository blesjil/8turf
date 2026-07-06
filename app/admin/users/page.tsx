import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { CreateUserForm } from './create-user-form';
import { PromoteButton } from './promote-button';
import { ResetPasswordButton } from './reset-password-button';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: string;
}

export default async function AdminUsersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/authenticate');
  }
  if (session.user.role !== 'admin') {
    notFound();
  }

  const users = await query<UserRow>(
    'SELECT id, name, email, role, "createdAt" FROM "user" ORDER BY "createdAt" DESC',
  );

  return (
    <div className='max-w-3xl mx-auto p-8 space-y-8'>
      <h1 className='text-2xl font-bold'>Manage Users</h1>

      <CreateUserForm />

      <table className='w-full text-sm border-collapse'>
        <thead>
          <tr className='text-left border-b border-border'>
            <th className='py-2 pr-4'>Name</th>
            <th className='py-2 pr-4'>Email</th>
            <th className='py-2 pr-4'>Role</th>
            <th className='py-2 pr-4'></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className='border-b border-border/50'>
              <td className='py-2 pr-4'>{user.name}</td>
              <td className='py-2 pr-4'>{user.email}</td>
              <td className='py-2 pr-4'>{user.role ?? 'user'}</td>
              <td className='py-2 pr-4'>
                <div className='flex items-center gap-3'>
                  {user.role !== 'admin' && <PromoteButton userId={user.id} />}
                  <ResetPasswordButton userId={user.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
