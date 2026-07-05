'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { archiveUnit, deleteUnit, type DeleteUnitResult } from './actions';

export function UnitActions({ propertyId, unitId }: { propertyId: string; unitId: string }) {
  const [state, deleteAction, isPending] = useActionState<DeleteUnitResult, FormData>(
    deleteUnit,
    {},
  );

  return (
    <div className='flex items-center gap-3'>
      <Link
        href={`/properties/${propertyId}/units/${unitId}/edit`}
        className='text-sm text-foreground/60 hover:text-foreground'
      >
        Edit
      </Link>
      <form action={archiveUnit}>
        <input type='hidden' name='id' value={unitId} />
        <button
          type='submit'
          className='text-sm text-foreground/60 hover:text-foreground cursor-pointer'
        >
          Archive
        </button>
      </form>
      <form action={deleteAction}>
        <input type='hidden' name='id' value={unitId} />
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
