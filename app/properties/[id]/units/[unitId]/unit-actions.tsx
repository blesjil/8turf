'use client';

import { useActionState, useRef } from 'react';
import Link from 'next/link';
import { archiveUnit, deleteUnit, type DeleteUnitResult } from './actions';
import { ConfirmButton } from '@/components/confirm-button';

export function UnitActions({
  propertyId,
  unitId,
  isAdmin,
}: {
  propertyId: string;
  unitId: string;
  isAdmin: boolean;
}) {
  const [state, deleteAction, isPending] = useActionState<DeleteUnitResult, FormData>(
    deleteUnit,
    {},
  );
  const archiveFormRef = useRef<HTMLFormElement>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className='flex items-center gap-3'>
      <Link
        href={`/properties/${propertyId}/units/${unitId}/edit`}
        className='text-sm text-foreground/60 hover:text-foreground'
      >
        Edit
      </Link>
      {isAdmin && (
        <form ref={archiveFormRef} action={archiveUnit}>
          <input type='hidden' name='id' value={unitId} />
          <ConfirmButton
            formRef={archiveFormRef}
            message="Archive this unit? It will be hidden from the property's active list."
            confirmLabel='Archive'
            triggerClassName='text-sm text-foreground/60 hover:text-foreground cursor-pointer'
          >
            Archive
          </ConfirmButton>
        </form>
      )}
      <form ref={deleteFormRef} action={deleteAction}>
        <input type='hidden' name='id' value={unitId} />
        <ConfirmButton
          formRef={deleteFormRef}
          message='Delete this unit? This cannot be undone.'
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
