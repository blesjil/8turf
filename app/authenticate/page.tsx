'use client';

import { useActionState } from 'react';
import { signIn } from '@/lib/auth-client';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandMark } from '@/components/header';

type FormState = {
  error: string;
};

function AuthForm() {
  const [state, submitAction, isPending] = useActionState<FormState, FormData>(
    async (_prevState, formData) => {
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      try {
        const result = await signIn.email({
          email,
          password,
          callbackURL: '/dashboard',
        });
        if (result.error) {
          return { error: 'Invalid email or password.' };
        }
      } catch {
        return { error: 'An unexpected error occurred' };
      }

      return { error: '' };
    },
    { error: '' },
  );

  return (
    <Card className='w-full'>
      <CardHeader className='items-center text-center'>
        <BrandMark className='mx-auto mb-2 size-10 rounded-xl text-lg' />
        <CardTitle className='text-xl'>Sign in to 8turf</CardTitle>
        <CardDescription>Manage your properties, tenants, and payments.</CardDescription>
      </CardHeader>
      <form action={submitAction}>
        <CardContent className='space-y-4'>
          {state.error && (
            <Alert variant='destructive' role='alert'>
              <AlertTitle>{state.error}</AlertTitle>
            </Alert>
          )}
          <div className='space-y-2'>
            <Label htmlFor='email'>Email</Label>
            <Input id='email' name='email' type='email' required autoComplete='email' />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='password'>Password</Label>
            <Input
              id='password'
              name='password'
              type='password'
              required
              minLength={8}
              autoComplete='current-password'
            />
          </div>
        </CardContent>
        <CardFooter className='mt-6 flex-col gap-3'>
          <Button type='submit' disabled={isPending} className='w-full'>
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className='text-center text-xs text-muted-foreground'>
            Forgot your password? Ask an admin to reset it from Manage Users.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function Authenticate() {
  return (
    <div className='flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6'>
      <main className='w-full max-w-sm'>
        <AuthForm />
      </main>
    </div>
  );
}
