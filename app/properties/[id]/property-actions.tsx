'use client';

import { useActionState, useRef } from 'react';
import Link from 'next/link';
import { archiveProperty, deleteProperty, type DeletePropertyResult } from '../actions';
import { ConfirmButton } from '@/components/confirm-button';

export function PropertyActions({ propertyId, isAdmin }: { propertyId: string; isAdmin: boolean }) {
  const [state, deleteAction, isPending] = useActionState<DeletePropertyResult, FormData>(
    deleteProperty,
    {},
  );
  const archiveFormRef = useRef<HTMLFormElement>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className='flex items-center gap-3'>
      <Link
        href={`/properties/${propertyId}/edit`}
        className='text-sm text-foreground/60 hover:text-foreground'
      >
        Edit
      </Link>
      {isAdmin && (
        <form ref={archiveFormRef} action={archiveProperty}>
          <input type='hidden' name='id' value={propertyId} />
          <ConfirmButton
            formRef={archiveFormRef}
            message='Archive this property? It will be hidden from your active list.'
            confirmLabel='Archive'
            triggerClassName='text-sm text-foreground/60 hover:text-foreground cursor-pointer'
          >
            Archive
          </ConfirmButton>
        </form>
      )}
      <form ref={deleteFormRef} action={deleteAction}>
        <input type='hidden' name='id' value={propertyId} />
        <ConfirmButton
          formRef={deleteFormRef}
          message='Delete this property? This cannot be undone.'
          confirmLabel='Delete'
          tone='danger'
          disabled={isPending}
          triggerClassName='text-sm text-red-600 hover:text-red-800 cursor-pointer disabled:opacity-50'
        >
          Delete
        </ConfirmButton>
      </form>
      {state.error && <p className='text-sm text-red-600'>{state.error}</p>}
    </div>
  );
}
