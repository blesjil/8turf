'use client';

import { useActionState } from 'react';
import { createProperty, type PropertyActionResult } from '../actions';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NewPropertyForm() {
  const [state, formAction, isPending] = useActionState<PropertyActionResult, FormData>(
    createProperty,
    {},
  );

  return (
    <form action={formAction} className='space-y-5'>
      {state.error?.general && (
        <Alert variant='destructive'>
          <AlertTitle>{state.error.general}</AlertTitle>
        </Alert>
      )}

      <div className='space-y-2'>
        <Label htmlFor='name'>Name</Label>
        <Input id='name' name='name' required />
        {state.error?.name && <p className='text-sm text-destructive'>{state.error.name[0]}</p>}
      </div>

      <div className='space-y-2'>
        <Label htmlFor='address'>Address</Label>
        <Input id='address' name='address' required />
        {state.error?.address && (
          <p className='text-sm text-destructive'>{state.error.address[0]}</p>
        )}
      </div>

      <Button type='submit' disabled={isPending}>
        {isPending ? 'Creating…' : 'Create property'}
      </Button>
    </form>
  );
}
