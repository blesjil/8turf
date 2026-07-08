'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createProperty, type PropertyActionResult } from '../actions';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

export interface OwnerOption {
  id: string;
  name: string;
  email: string;
}

export function NewPropertyForm({
  owners,
  currentUserId,
}: {
  owners?: OwnerOption[];
  currentUserId?: string;
}) {
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

      {owners && owners.length > 0 && (
        <div className='space-y-2'>
          <Label htmlFor='ownerId'>Owner</Label>
          <NativeSelect id='ownerId' name='ownerId' defaultValue={currentUserId}>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} ({owner.email})
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <div className='flex gap-2'>
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Creating…' : 'Create property'}
        </Button>
        <Button nativeButton={false} variant='outline' render={<Link href='/dashboard' />}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
