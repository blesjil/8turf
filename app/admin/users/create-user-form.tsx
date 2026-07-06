'use client';

import { useActionState } from 'react';
import { createUser, type CreateUserResult } from './actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: CreateUserResult = { success: false };

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUser, initialState);

  return (
    <div className='space-y-4'>
      <Card className='p-4'>
        <form action={formAction} className='flex flex-wrap items-end gap-3'>
          {state.error?.general && (
            <Alert variant='destructive' className='w-full'>
              <AlertTitle>{state.error.general}</AlertTitle>
            </Alert>
          )}

          <div className='w-full sm:w-auto'>
            <Label htmlFor='name' className='mb-2'>
              Name
            </Label>
            <Input type='text' id='name' name='name' required className='w-full sm:w-48' />
            {state.error?.name && (
              <p className='mt-1 text-sm text-destructive'>{state.error.name[0]}</p>
            )}
          </div>

          <div className='w-full sm:w-auto'>
            <Label htmlFor='email' className='mb-2'>
              Email
            </Label>
            <Input type='email' id='email' name='email' required className='w-full sm:w-64' />
            {state.error?.email && (
              <p className='mt-1 text-sm text-destructive'>{state.error.email[0]}</p>
            )}
          </div>

          <Button type='submit' disabled={isPending}>
            {isPending ? 'Creating…' : 'Create user'}
          </Button>
        </form>
      </Card>

      {state.success && state.tempPassword && (
        <Alert>
          <AlertTitle>User created</AlertTitle>
          <AlertDescription>
            Temporary password (shown once — relay it to the new user):{' '}
            <code className='rounded bg-muted px-1.5 py-0.5 font-mono'>{state.tempPassword}</code>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
