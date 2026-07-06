'use client';

import { useActionState, useState } from 'react';
import { resetUserPassword, type ResetPasswordResult } from './actions';

const initialState: ResetPasswordResult = { success: false };

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(resetUserPassword, initialState);
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  return (
    <div className='inline-flex flex-col items-start gap-1'>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='px-3 py-1 text-sm border border-border rounded-lg hover:bg-foreground/5'
      >
        Reset password
      </button>

      {open && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
          onClick={() => setOpen(false)}
        >
          <div
            className='w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg'
            onClick={(e) => e.stopPropagation()}
          >
            <p className='text-sm mb-4'>
              Reset this user&apos;s password? Their current password will stop working.
            </p>
            <form action={formAction} onSubmit={() => setOpen(false)} className='space-y-3'>
              <input type='hidden' name='userId' value={userId} />
              <div>
                <label className='block text-xs mb-1'>New password (optional)</label>
                <input
                  type='text'
                  name='newPassword'
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder='Leave blank to auto-generate'
                  className='w-full px-3 py-2 text-sm border border-border rounded-lg'
                />
              </div>
              <div className='flex justify-end gap-3'>
                <button
                  type='button'
                  className='text-sm text-foreground/60 hover:text-foreground cursor-pointer'
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isPending}
                  className='text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer'
                >
                  {isPending ? 'Resetting...' : 'Reset password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {state.error && <span className='text-sm text-red-600'>{state.error}</span>}
      {state.success && state.tempPassword && (
        <span className='text-sm bg-green-100 border border-green-300 text-green-900 rounded-lg px-2 py-1'>
          New password (shown once):{' '}
          <code className='font-mono bg-white/60 px-1.5 py-0.5 rounded'>{state.tempPassword}</code>
        </span>
      )}
    </div>
  );
}
