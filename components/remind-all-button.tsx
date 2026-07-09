'use client';

import { useState, useTransition } from 'react';
import { sendAllDueReminders, type BulkReminderResult } from '@/app/payments/actions';
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

export function RemindAllButton({
  period,
  monthLabel,
  unpaidWithContact,
  unpaidWithoutContact,
}: {
  period: string;
  monthLabel: string;
  unpaidWithContact: number;
  unpaidWithoutContact: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkReminderResult | null>(null);

  if (unpaidWithContact === 0) return null;

  function sendAll() {
    setResult(null);
    startTransition(async () => {
      setResult(await sendAllDueReminders(period));
    });
  }

  const summary =
    result &&
    (result.error
      ? result.error
      : [
          `Sent ${result.sent} reminder${result.sent === 1 ? '' : 's'}`,
          result.skippedNoContact > 0 ? `${result.skippedNoContact} without contact info` : null,
          result.failed > 0 ? `${result.failed} failed` : null,
        ]
          .filter(Boolean)
          .join(' · '));

  return (
    <div className='flex flex-col items-end gap-0.5'>
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button type='button' variant='outline' size='sm' disabled={pending} />}
        >
          {pending ? 'Sending reminders…' : `Remind all unpaid (${unpaidWithContact})`}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send reminders to all unpaid tenants?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends an email and/or SMS rent reminder to {unpaidWithContact} tenant
              {unpaidWithContact === 1 ? '' : 's'} with unpaid or partial dues for {monthLabel}.
              {unpaidWithoutContact > 0 &&
                ` ${unpaidWithoutContact} unpaid tenant${unpaidWithoutContact === 1 ? ' has' : 's have'} no email or phone and will be skipped.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={sendAll}>Send reminders</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {summary && (
        <span
          className={`text-xs ${result?.error || result?.failed ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {summary}
        </span>
      )}
    </div>
  );
}
