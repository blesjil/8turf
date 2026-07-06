'use client';

import { useActionState, useRef } from 'react';
import Link from 'next/link';
import { archiveUnit, deleteUnit, type DeleteUnitResult } from './actions';
import { Button } from '@/components/ui/button';
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
    <div className='flex items-center gap-2'>
      <Button
        variant='outline'
        size='sm'
        render={<Link href={`/properties/${propertyId}/units/${unitId}/edit`} />}
      >
        Edit
      </Button>
      {isAdmin && (
        <form ref={archiveFormRef} action={archiveUnit}>
          <input type='hidden' name='id' value={unitId} />
          <ConfirmButton
            formRef={archiveFormRef}
            title='Archive unit'
            message="Archive this unit? It will be hidden from the property's active list."
            confirmLabel='Archive'
            triggerVariant='outline'
          >
            Archive
          </ConfirmButton>
        </form>
      )}
      <form ref={deleteFormRef} action={deleteAction}>
        <input type='hidden' name='id' value={unitId} />
        <ConfirmButton
          formRef={deleteFormRef}
          title='Delete unit'
          message='Delete this unit? This cannot be undone.'
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
