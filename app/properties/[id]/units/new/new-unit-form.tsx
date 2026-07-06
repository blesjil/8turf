'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createUnit, type UnitActionResult } from './actions';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NewUnitForm({ propertyId }: { propertyId: string }) {
  const [state, formAction, isPending] = useActionState<UnitActionResult, FormData>(createUnit, {});

  return (
    <form action={formAction} className='space-y-5'>
      <input type='hidden' name='propertyId' value={propertyId} />

      {state.error?.general && (
        <Alert variant='destructive'>
          <AlertTitle>{state.error.general}</AlertTitle>
        </Alert>
      )}

      <div className='space-y-2'>
        <Label htmlFor='unitLabel'>Unit label</Label>
        <Input id='unitLabel' name='unitLabel' required placeholder='Unit 2B' />
        {state.error?.unitLabel && (
          <p className='text-sm text-destructive'>{state.error.unitLabel[0]}</p>
        )}
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='bedrooms'>Bedrooms</Label>
          <Input
            id='bedrooms'
            name='bedrooms'
            type='number'
            min='0'
            step='1'
            defaultValue='1'
            required
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='bathrooms'>Bathrooms</Label>
          <Input
            id='bathrooms'
            name='bathrooms'
            type='number'
            min='0'
            step='0.5'
            defaultValue='1'
            required
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='rentAmountDollars'>Asking rent (₱/mo)</Label>
        <Input
          id='rentAmountDollars'
          name='rentAmountDollars'
          type='number'
          min='0'
          step='0.01'
          required
          onChange={(e) => {
            const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
            const hidden = e.currentTarget.form?.elements.namedItem(
              'rentAmount',
            ) as HTMLInputElement | null;
            if (hidden) hidden.value = String(cents);
          }}
        />
        <input type='hidden' name='rentAmount' />
        {state.error?.rentAmount && (
          <p className='text-sm text-destructive'>{state.error.rentAmount[0]}</p>
        )}
      </div>

      <div className='flex gap-2'>
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Creating…' : 'Add unit'}
        </Button>
        <Button
          nativeButton={false}
          variant='outline'
          render={<Link href={`/properties/${propertyId}`} />}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
