'use client';

import { useActionState } from 'react';
import { createProperty, type PropertyActionResult } from '../actions';

export function NewPropertyForm() {
  const [state, formAction, isPending] = useActionState<PropertyActionResult, FormData>(
    createProperty,
    {},
  );

  return (
    <form action={formAction} className='space-y-4'>
      {state.error?.general && (
        <div className='p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg'>
          {state.error.general}
        </div>
      )}

      <div>
        <label htmlFor='name' className='block text-sm font-medium mb-1'>
          Name
        </label>
        <input
          id='name'
          name='name'
          required
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {state.error?.name && <p className='mt-1 text-sm text-red-600'>{state.error.name[0]}</p>}
      </div>

      <div>
        <label htmlFor='address' className='block text-sm font-medium mb-1'>
          Address
        </label>
        <input
          id='address'
          name='address'
          required
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {state.error?.address && (
          <p className='mt-1 text-sm text-red-600'>{state.error.address[0]}</p>
        )}
      </div>

      <button
        type='submit'
        disabled={isPending}
        className='bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
      >
        {isPending ? 'Creating...' : 'Create Property'}
      </button>
    </form>
  );
}
