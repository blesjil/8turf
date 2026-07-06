'use client';

import { useActionState, useState } from 'react';
import { resetUserPassword, type ResetPasswordResult } from './actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: ResetPasswordResult = { success: false };

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(resetUserPassword, initialState);
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  return (
    <div className='inline-flex flex-col items-start gap-1'>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button type='button' variant='ghost' size='sm' />}>
          Reset password
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Reset this user&apos;s password? Their current password will stop working.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} onSubmit={() => setOpen(false)} className='space-y-4'>
            <input type='hidden' name='userId' value={userId} />
            <div className='space-y-2'>
              <Label htmlFor={`new-password-${userId}`}>New password (optional)</Label>
              <Input
                type='text'
                id={`new-password-${userId}`}
                name='newPassword'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder='Leave blank to auto-generate'
              />
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending ? 'Resetting…' : 'Reset password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {state.error && <span className='text-sm text-destructive'>{state.error}</span>}
      {state.success && state.tempPassword && (
        <Alert className='w-auto'>
          <AlertTitle>New password (shown once)</AlertTitle>
          <AlertDescription>
            <code className='rounded bg-muted px-1.5 py-0.5 font-mono'>{state.tempPassword}</code>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
