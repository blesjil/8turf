'use client';

import { useActionState } from 'react';
import { updateUnit, type UnitActionResult } from '../actions';

export function EditUnitForm({
  id,
  unitLabel,
  bedrooms,
  bathrooms,
  rentAmount,
}: {
  id: string;
  unitLabel: string;
  bedrooms: number;
  bathrooms: number;
  rentAmount: number;
}) {
  const [state, formAction, isPending] = useActionState<UnitActionResult, FormData>(updateUnit, {});

  return (
    <form action={formAction} className='space-y-4'>
      <input type='hidden' name='id' value={id} />

      {state.error?.general && (
        <div className='p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg'>
          {state.error.general}
        </div>
      )}

      <div>
        <label htmlFor='unitLabel' className='block text-sm font-medium mb-1'>
          Unit Label
        </label>
        <input
          id='unitLabel'
          name='unitLabel'
          defaultValue={unitLabel}
          required
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {state.error?.unitLabel && (
          <p className='mt-1 text-sm text-red-600'>{state.error.unitLabel[0]}</p>
        )}
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div>
          <label htmlFor='bedrooms' className='block text-sm font-medium mb-1'>
            Bedrooms
          </label>
          <input
            id='bedrooms'
            name='bedrooms'
            type='number'
            min='0'
            step='1'
            defaultValue={bedrooms}
            required
            className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
        <div>
          <label htmlFor='bathrooms' className='block text-sm font-medium mb-1'>
            Bathrooms
          </label>
          <input
            id='bathrooms'
            name='bathrooms'
            type='number'
            min='0'
            step='0.5'
            defaultValue={bathrooms}
            required
            className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
      </div>

      <div>
        <label htmlFor='rentAmountDollars' className='block text-sm font-medium mb-1'>
          Asking Rent ($/mo)
        </label>
        <input
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
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        <input type='hidden' name='rentAmount' defaultValue={rentAmount} />
        {state.error?.rentAmount && (
          <p className='mt-1 text-sm text-red-600'>{state.error.rentAmount[0]}</p>
        )}
      </div>

      <button
        type='submit'
        disabled={isPending}
        className='bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
      >
        {isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
