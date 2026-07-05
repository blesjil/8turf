'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { archiveProperty, deleteProperty, type DeletePropertyResult } from '../actions';

export function PropertyActions({ propertyId }: { propertyId: string }) {
  const [state, deleteAction, isPending] = useActionState<DeletePropertyResult, FormData>(
    deleteProperty,
    {},
  );

  return (
    <div className='flex items-center gap-3'>
      <Link
        href={`/properties/${propertyId}/edit`}
        className='text-sm text-foreground/60 hover:text-foreground'
      >
        Edit
      </Link>
      <form action={archiveProperty}>
        <input type='hidden' name='id' value={propertyId} />
        <button
          type='submit'
          className='text-sm text-foreground/60 hover:text-foreground cursor-pointer'
        >
          Archive
        </button>
      </form>
      <form action={deleteAction}>
        <input type='hidden' name='id' value={propertyId} />
        <button
          type='submit'
          disabled={isPending}
          className='text-sm text-red-600 hover:text-red-800 cursor-pointer disabled:opacity-50'
        >
          Delete
        </button>
      </form>
      {state.error && <p className='text-sm text-red-600'>{state.error}</p>}
    </div>
  );
}
