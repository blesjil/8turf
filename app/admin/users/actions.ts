'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { APIError } from 'better-auth/api';
import { auth } from '@/lib/auth';
import { createUserSchema, promoteToAdminSchema, resetUserPasswordSchema } from '@/lib/validation';
import { generateTempPassword } from '@/lib/generate-password';

async function requireAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/authenticate');
  }
  if (session.user.role !== 'admin') {
    redirect('/dashboard');
  }
  return session;
}

export interface CreateUserResult {
  success: boolean;
  tempPassword?: string;
  error?: { email?: string[]; name?: string[]; general?: string };
}

export async function createUser(
  _prevState: CreateUserResult,
  formData: FormData,
): Promise<CreateUserResult> {
  await requireAdminSession();

  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const tempPassword = generateTempPassword();

  try {
    await auth.api.createUser({
      body: {
        email: parsed.data.email,
        name: parsed.data.name,
        password: tempPassword,
        role: 'user',
      },
      headers: await headers(),
    });
  } catch (err) {
    const message = err instanceof APIError ? err.message : 'Failed to create user.';
    return { success: false, error: { general: message } };
  }

  revalidatePath('/admin/users');
  return { success: true, tempPassword };
}

export interface ResetPasswordResult {
  success: boolean;
  tempPassword?: string;
  error?: string;
}

export async function resetUserPassword(
  _prevState: ResetPasswordResult,
  formData: FormData,
): Promise<ResetPasswordResult> {
  await requireAdminSession();

  const parsed = resetUserPasswordSchema.safeParse({
    userId: formData.get('userId'),
    newPassword: formData.get('newPassword'),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.flatten().fieldErrors.newPassword?.[0] ?? 'Invalid input.',
    };
  }

  const newPassword = parsed.data.newPassword || generateTempPassword();

  try {
    await auth.api.setUserPassword({
      body: { userId: parsed.data.userId, newPassword },
      headers: await headers(),
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof APIError ? err.message : 'Failed to reset password.',
    };
  }

  return { success: true, tempPassword: newPassword };
}

export interface PromoteResult {
  success: boolean;
  error?: string;
}

export async function promoteToAdmin(
  _prevState: PromoteResult,
  formData: FormData,
): Promise<PromoteResult> {
  await requireAdminSession();

  const parsed = promoteToAdminSchema.safeParse({ userId: formData.get('userId') });
  if (!parsed.success) {
    return { success: false, error: 'Invalid user id.' };
  }

  try {
    await auth.api.setRole({
      body: { userId: parsed.data.userId, role: 'admin' },
      headers: await headers(),
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof APIError ? err.message : 'Failed to promote user.',
    };
  }

  revalidatePath('/admin/users');
  return { success: true };
}
