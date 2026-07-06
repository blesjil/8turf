'use client';

import { useActionState, useRef } from 'react';
import Link from 'next/link';
import { archiveProperty, deleteProperty, type DeletePropertyResult } from '../actions';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/confirm-button';

export function PropertyActions({ propertyId, isAdmin }: { propertyId: string; isAdmin: boolean }) {
  const [state, deleteAction, isPending] = useActionState<DeletePropertyResult, FormData>(
    deleteProperty,
    {},
  );
  const archiveFormRef = useRef<HTMLFormElement>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className='flex items-center gap-2'>
      <Button
        variant='outline'
        size='sm'
        nativeButton={false}
        render={<Link href={`/properties/${propertyId}/edit`} />}
      >
        Edit
      </Button>
      {isAdmin && (
        <form ref={archiveFormRef} action={archiveProperty}>
          <input type='hidden' name='id' value={propertyId} />
          <ConfirmButton
            formRef={archiveFormRef}
            title='Archive property'
            message='Archive this property? It will be hidden from your active list.'
            confirmLabel='Archive'
            triggerVariant='outline'
          >
            Archive
          </ConfirmButton>
        </form>
      )}
      <form ref={deleteFormRef} action={deleteAction}>
        <input type='hidden' name='id' value={propertyId} />
        <ConfirmButton
          formRef={deleteFormRef}
          title='Delete property'
          message='Delete this property? This cannot be undone.'
          confirmLabel='Delete'
          tone='danger'
          disabled={isPending}
          triggerVariant='destructive'
        >
          Delete
        </ConfirmButton>
      </form>
      {state.error && <p className='text-sm text-destructive'>{state.error}</p>}
    </div>
  );
}
