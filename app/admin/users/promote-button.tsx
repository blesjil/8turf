'use client';

import { useActionState } from 'react';
import { promoteToAdmin, type PromoteResult } from './actions';
import { Button } from '@/components/ui/button';

const initialState: PromoteResult = { success: false };

interface PromoteButtonProps {
  userId: string;
}

export function PromoteButton({ userId }: PromoteButtonProps) {
  const [state, formAction, isPending] = useActionState(promoteToAdmin, initialState);

  return (
    <form action={formAction} className='inline-flex items-center gap-2'>
      <input type='hidden' name='userId' value={userId} />
      <Button type='submit' variant='outline' size='sm' disabled={isPending}>
        {isPending ? 'Promoting…' : 'Make admin'}
      </Button>
      {state.error && <span className='text-sm text-destructive'>{state.error}</span>}
    </form>
  );
}
