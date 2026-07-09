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

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  both: 'Email + SMS',
};

export function SendReminderButton({
  tenantId,
  period,
  lastReminded,
}: {
  tenantId: string;
  period: string;
  lastReminded: { date: string; channel: string } | null;
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
  const channelLabel = lastReminded
    ? (CHANNEL_LABELS[lastReminded.channel] ?? lastReminded.channel)
    : null;

  return (
    <div className='flex flex-col items-end gap-0.5'>
      {lastReminded ? (
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
                This tenant was already reminded on {lastReminded.date} via {channelLabel} for this
                month.
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
      {!sentNow && lastReminded && (
        <span className='text-xs text-muted-foreground'>
          Reminded {lastReminded.date} · {channelLabel}
        </span>
      )}
      {error && <span className='text-xs text-destructive'>{error}</span>}
    </div>
  );
}
