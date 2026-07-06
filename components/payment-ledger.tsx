'use client';

import { useActionState, useRef, useState } from 'react';
import { formatCents } from '@/lib/money';
import { formatDate, formatPeriod } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { MonthPickerField } from '@/components/ui/month-picker-field';
import { ConfirmButton } from '@/components/confirm-button';
import {
  recordPayment,
  updatePayment,
  deletePayment,
  type PaymentActionResult,
} from '@/app/properties/[id]/units/[unitId]/actions';

export interface Payment {
  id: string;
  amount: number;
  period: string;
  paid_date: string;
  payment_type: 'deposit' | 'advance' | 'reservation' | 'rental';
  method: string | null;
  notes: string | null;
}

const TYPE_LABELS: Record<Payment['payment_type'], string> = {
  deposit: 'Deposit',
  advance: 'Advance',
  reservation: 'Reservation',
  rental: 'Rental',
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className='mt-1 text-sm text-destructive'>{messages[0]}</p>;
}

function PaymentFormFields({ state, payment }: { state: PaymentActionResult; payment?: Payment }) {
  return (
    <>
      <div>
        <Label className='mb-2 text-xs'>Period</Label>
        <MonthPickerField name='period' defaultValue={payment?.period} required />
        <FieldError messages={state.error?.period} />
      </div>
      <div>
        <Label className='mb-2 text-xs'>Amount (₱)</Label>
        <Input
          name='amountDollars'
          type='number'
          step='0.01'
          min='0.01'
          defaultValue={payment ? (payment.amount / 100).toFixed(2) : undefined}
          required={!payment}
          className='w-32'
          onChange={(e) => {
            const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
            const hidden = e.currentTarget.form?.elements.namedItem(
              'amount',
            ) as HTMLInputElement | null;
            if (hidden) hidden.value = String(cents);
          }}
        />
        <input type='hidden' name='amount' defaultValue={payment?.amount} />
        <FieldError messages={state.error?.amount} />
      </div>
      <div>
        <Label className='mb-2 text-xs'>Paid date</Label>
        <DatePickerField name='paidDate' defaultValue={payment?.paid_date} required />
        <FieldError messages={state.error?.paidDate} />
      </div>
      <div>
        <Label className='mb-2 text-xs'>Type</Label>
        <NativeSelect name='paymentType' defaultValue={payment?.payment_type ?? 'rental'}>
          <option value='rental'>Rental</option>
          <option value='deposit'>Deposit</option>
          <option value='advance'>Advance</option>
          <option value='reservation'>Reservation</option>
        </NativeSelect>
        <FieldError messages={state.error?.paymentType} />
      </div>
      <div>
        <Label className='mb-2 text-xs'>Method</Label>
        <NativeSelect name='method' defaultValue={payment?.method ?? ''}>
          <option value=''>—</option>
          <option value='cash'>Cash</option>
          <option value='bank_transfer'>Bank Transfer</option>
          <option value='gcash'>GCash</option>
          <option value='other'>Other</option>
        </NativeSelect>
        <FieldError messages={state.error?.method} />
      </div>
      <div>
        <Label className='mb-2 text-xs'>Notes</Label>
        <Input name='notes' defaultValue={payment?.notes ?? ''} className='w-40' />
        <FieldError messages={state.error?.notes} />
      </div>
    </>
  );
}

function PaymentRow({ payment, readOnly }: { payment: Payment; readOnly?: boolean }) {
  const [state, formAction, isPending] = useActionState<PaymentActionResult, FormData>(
    updatePayment,
    {},
  );
  const [isEditing, setIsEditing] = useState(false);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  if (isEditing) {
    return (
      <TableRow>
        <TableCell colSpan={7} className='py-3'>
          <form action={formAction} className='flex flex-wrap items-end gap-3'>
            <input type='hidden' name='id' value={payment.id} />
            {state.error?.general && (
              <p className='w-full text-sm text-destructive'>{state.error.general}</p>
            )}
            <PaymentFormFields state={state} payment={payment} />
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button type='button' variant='outline' onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </form>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{formatPeriod(payment.period)}</TableCell>
      <TableCell className='text-right font-mono tabular-nums'>
        {formatCents(payment.amount)}
      </TableCell>
      <TableCell>{formatDate(payment.paid_date)}</TableCell>
      <TableCell>{TYPE_LABELS[payment.payment_type]}</TableCell>
      <TableCell>{payment.method || '—'}</TableCell>
      <TableCell className='max-w-48 truncate'>{payment.notes || '—'}</TableCell>
      {!readOnly && (
        <TableCell>
          <div className='flex items-center justify-end gap-1'>
            <Button type='button' variant='ghost' size='sm' onClick={() => setIsEditing(true)}>
              Edit
            </Button>
            <form
              ref={deleteFormRef}
              action={async (formData) => {
                formData.set('id', payment.id);
                await deletePayment(formData);
              }}
            >
              <ConfirmButton
                formRef={deleteFormRef}
                title='Delete payment'
                message='Delete this payment? This cannot be undone.'
                confirmLabel='Delete'
                tone='danger'
                triggerClassName='text-destructive hover:text-destructive'
              >
                Delete
              </ConfirmButton>
            </form>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

export function PaymentLedger({
  tenantId,
  payments,
  readOnly,
}: {
  tenantId: string;
  payments: Payment[];
  readOnly?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<PaymentActionResult, FormData>(
    recordPayment,
    {},
  );

  return (
    <div className='space-y-4'>
      {!readOnly && (
        <Card className='p-4'>
          <form action={formAction} className='flex flex-wrap items-end gap-3'>
            <input type='hidden' name='tenantId' value={tenantId} />
            {state.error?.general && (
              <p className='w-full text-sm text-destructive'>{state.error.general}</p>
            )}
            <PaymentFormFields state={state} />
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Recording…' : 'Record payment'}
            </Button>
          </form>
        </Card>
      )}

      {payments.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No payments recorded yet.</p>
      ) : (
        <Card className='py-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className='text-right'>Amount</TableHead>
                  <TableHead>Paid date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Notes</TableHead>
                  {!readOnly && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <PaymentRow key={p.id} payment={p} readOnly={readOnly} />
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
