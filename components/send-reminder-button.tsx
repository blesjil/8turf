'use client';

import { useState, useTransition } from 'react';
import { sendDueReminder } from '@/app/payments/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function SendReminderButton({
  tenantId,
  period,
  lastRemindedAt,
}: {
  tenantId: string;
  period: string;
  lastRemindedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentNow, setSentNow] = useState(false);

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await sendDueReminder(tenantId, period);
      if (result.ok) setSentNow(true);
      else setError(result.error ?? 'Failed to send reminder.');
    });
  }

  const label = pending ? 'Sending…' : 'Remind';

  return (
    <div className='flex flex-col items-end gap-0.5'>
      {lastRemindedAt ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button type='button' variant='outline' size='xs' disabled={pending} />}
          >
            {label}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send another reminder?</AlertDialogTitle>
              <AlertDialogDescription>
                This tenant was already reminded on {lastRemindedAt} for this month.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={send}>Send reminder</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button type='button' variant='outline' size='xs' disabled={pending} onClick={send}>
          {label}
        </Button>
      )}
      {sentNow && !pending && <span className='text-xs text-muted-foreground'>Reminder sent</span>}
      {!sentNow && lastRemindedAt && (
        <span className='text-xs text-muted-foreground'>Reminded {lastRemindedAt}</span>
      )}
      {error && <span className='text-xs text-destructive'>{error}</span>}
    </div>
  );
}
