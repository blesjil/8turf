'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updateUnit, type UnitActionResult } from '../actions';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function EditUnitForm({
  id,
  propertyId,
  unitLabel,
  bedrooms,
  bathrooms,
  rentAmount,
}: {
  id: string;
  propertyId: string;
  unitLabel: string;
  bedrooms: number;
  bathrooms: number;
  rentAmount: number;
}) {
  const [state, formAction, isPending] = useActionState<UnitActionResult, FormData>(updateUnit, {});

  return (
    <form action={formAction} className='space-y-5'>
      <input type='hidden' name='id' value={id} />

      {state.error?.general && (
        <Alert variant='destructive'>
          <AlertTitle>{state.error.general}</AlertTitle>
        </Alert>
      )}

      <div className='space-y-2'>
        <Label htmlFor='unitLabel'>Unit label</Label>
        <Input id='unitLabel' name='unitLabel' defaultValue={unitLabel} required />
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
            defaultValue={bedrooms}
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
            defaultValue={bathrooms}
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
          defaultValue={(rentAmount / 100).toFixed(2)}
          required
          onChange={(e) => {
            const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
            const hidden = e.currentTarget.form?.elements.namedItem(
              'rentAmount',
            ) as HTMLInputElement | null;
            if (hidden) hidden.value = String(cents);
          }}
        />
        <input type='hidden' name='rentAmount' defaultValue={rentAmount} />
        {state.error?.rentAmount && (
          <p className='text-sm text-destructive'>{state.error.rentAmount[0]}</p>
        )}
      </div>

      <div className='flex gap-2'>
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button
          nativeButton={false}
          variant='outline'
          render={<Link href={`/properties/${propertyId}/units/${id}`} />}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
