'use client';

import { useActionState } from 'react';
import { promoteToAdmin, type PromoteResult } from './actions';

const initialState: PromoteResult = { success: false };

interface PromoteButtonProps {
  userId: string;
}

export function PromoteButton({ userId }: PromoteButtonProps) {
  const [state, formAction, isPending] = useActionState(promoteToAdmin, initialState);

  return (
    <form action={formAction} className='inline-flex items-center gap-2'>
      <input type='hidden' name='userId' value={userId} />
      <button
        type='submit'
        disabled={isPending}
        className='px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
      >
        {isPending ? 'Promoting...' : 'Make admin'}
      </button>
      {state.error && <span className='text-sm text-red-600'>{state.error}</span>}
    </form>
  );
}
