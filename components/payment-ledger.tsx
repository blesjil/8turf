'use client';

import { useActionState, useRef, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { formatCents } from '@/lib/money';
import { nextPeriodStart } from '@/lib/payment-status';
import { formatDate } from '@/lib/format-date';
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
import { ConfirmButton } from '@/components/confirm-button';
import { PAGE_SIZE, paginate } from '@/components/ui/pagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { TablePeriodFilter } from '@/components/ui/table-period-filter';
import {
  recordPayment,
  updatePayment,
  deletePayment,
  sendPaymentSms,
  type PaymentActionResult,
} from '@/app/properties/[id]/units/[unitId]/actions';

export interface Payment {
  id: string;
  amount: number;
  period: string;
  period_start: string;
  period_end: string;
  paid_date: string;
  payment_type: 'deposit' | 'advance' | 'reservation' | 'rental';
  method: string | null;
  notes: string | null;
  sms_sent_at: string | null;
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

function PaymentFormFields({
  state,
  payment,
  defaultPeriod,
  defaultAmount,
}: {
  state: PaymentActionResult;
  payment?: Payment;
  defaultPeriod?: { start: string; end: string };
  defaultAmount?: number;
}) {
  const initialAmount = payment?.amount ?? defaultAmount;
  return (
    <>
      <div className='w-full sm:w-auto'>
        <Label className='mb-2 text-xs'>Period start</Label>
        <DatePickerField
          name='periodStart'
          defaultValue={payment?.period_start ?? defaultPeriod?.start}
          required
        />
        <FieldError messages={state.error?.periodStart} />
      </div>
      <div className='w-full sm:w-auto'>
        <Label className='mb-2 text-xs'>Period end</Label>
        <DatePickerField
          name='periodEnd'
          defaultValue={payment?.period_end ?? defaultPeriod?.end}
          required
        />
        <FieldError messages={state.error?.periodEnd} />
      </div>
      <div className='w-full sm:w-auto'>
        <Label className='mb-2 text-xs'>Amount (₱)</Label>
        <Input
          name='amountDollars'
          type='number'
          step='0.01'
          min='0.01'
          defaultValue={initialAmount != null ? (initialAmount / 100).toFixed(2) : undefined}
          required={!payment}
          className='w-full sm:w-32'
          onChange={(e) => {
            const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
            const hidden = e.currentTarget.form?.elements.namedItem(
              'amount',
            ) as HTMLInputElement | null;
            if (hidden) hidden.value = String(cents);
          }}
        />
        <input type='hidden' name='amount' defaultValue={initialAmount} />
        <FieldError messages={state.error?.amount} />
      </div>
      <div className='w-full sm:w-auto'>
        <Label className='mb-2 text-xs'>Paid date</Label>
        <DatePickerField
          name='paidDate'
          defaultValue={payment?.paid_date ?? format(new Date(), 'yyyy-MM-dd')}
          required
        />
        <FieldError messages={state.error?.paidDate} />
      </div>
      <div className='w-full sm:w-auto'>
        <Label className='mb-2 text-xs'>Type</Label>
        <NativeSelect name='paymentType' defaultValue={payment?.payment_type ?? 'rental'}>
          <option value='rental'>Rental</option>
          <option value='deposit'>Deposit</option>
          <option value='advance'>Advance</option>
          <option value='reservation'>Reservation</option>
        </NativeSelect>
        <FieldError messages={state.error?.paymentType} />
      </div>
      <div className='w-full sm:w-auto'>
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
      <div className='w-full sm:w-auto'>
        <Label className='mb-2 text-xs'>Notes</Label>
        <Input name='notes' defaultValue={payment?.notes ?? ''} className='w-full sm:w-40' />
        <FieldError messages={state.error?.notes} />
      </div>
    </>
  );
}

function SendSmsButton({ payment, hasPhone }: { payment: Payment; hasPhone?: boolean }) {
  const [state, formAction, isPending] = useActionState<PaymentActionResult, FormData>(
    sendPaymentSms,
    {},
  );

  if (payment.sms_sent_at) {
    return (
      <Button type='button' variant='ghost' size='sm' disabled>
        SMS sent
      </Button>
    );
  }

  // Only enable sending when the tenant has a mobile number on file.
  if (!hasPhone) {
    return (
      <Button type='button' variant='ghost' size='sm' disabled title='No mobile number on file'>
        Send SMS
      </Button>
    );
  }

  return (
    <div className='flex flex-col items-end'>
      <form action={formAction}>
        <input type='hidden' name='id' value={payment.id} />
        <Button type='submit' variant='ghost' size='sm' disabled={isPending}>
          {isPending ? 'Sending…' : 'Send SMS'}
        </Button>
      </form>
      {state.error?.general && <p className='text-xs text-destructive'>{state.error.general}</p>}
    </div>
  );
}

function PaymentRow({
  payment,
  readOnly,
  hasPhone,
}: {
  payment: Payment;
  readOnly?: boolean;
  hasPhone?: boolean;
}) {
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
      <TableCell className='whitespace-nowrap'>
        {formatDate(payment.period_start)} – {formatDate(payment.period_end)}
      </TableCell>
      <TableCell className='text-right font-mono tabular-nums'>
        {formatCents(payment.amount)}
      </TableCell>
      <TableCell>{formatDate(payment.paid_date)}</TableCell>
      <TableCell className='hidden sm:table-cell'>{TYPE_LABELS[payment.payment_type]}</TableCell>
      <TableCell className='hidden md:table-cell'>{payment.method || '—'}</TableCell>
      <TableCell className='hidden max-w-48 truncate md:table-cell'>
        {payment.notes || '—'}
      </TableCell>
      {!readOnly && (
        <TableCell>
          <div className='flex items-center justify-end gap-1'>
            <SendSmsButton payment={payment} hasPhone={hasPhone} />
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
  leaseStartDate,
  rentAmount,
  readOnly,
  hasPhone,
}: {
  tenantId: string;
  payments: Payment[];
  leaseStartDate?: string;
  rentAmount?: number;
  readOnly?: boolean;
  hasPhone?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<PaymentActionResult, FormData>(
    recordPayment,
    {},
  );

  const defaultStart = nextPeriodStart(payments, leaseStartDate);
  const defaultPeriod = defaultStart
    ? { start: defaultStart, end: format(addDays(parseISO(defaultStart), 30), 'yyyy-MM-dd') }
    : undefined;
  const [page, setPage] = useState(1);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');

  const years = [...new Set(payments.map((p) => p.period.slice(0, 4)))].sort().reverse();
  const filtered = payments.filter(
    (p) => (!year || p.period.slice(0, 4) === year) && (!month || p.period.slice(5, 7) === month),
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(totalPages, 1));

  return (
    <div className='space-y-4'>
      {!readOnly && (
        <Card className='p-4'>
          <form
            key={defaultPeriod?.start}
            action={formAction}
            className='flex flex-wrap items-end gap-3'
          >
            <input type='hidden' name='tenantId' value={tenantId} />
            {state.error?.general && (
              <p className='w-full text-sm text-destructive'>{state.error.general}</p>
            )}
            <PaymentFormFields
              state={state}
              defaultPeriod={defaultPeriod}
              defaultAmount={rentAmount}
            />
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Recording…' : 'Record payment'}
            </Button>
          </form>
        </Card>
      )}

      {payments.length > 0 && (
        <TablePeriodFilter
          years={years}
          year={year}
          month={month}
          onYearChange={(y) => {
            setYear(y);
            setPage(1);
          }}
          onMonthChange={(m) => {
            setMonth(m);
            setPage(1);
          }}
        />
      )}

      {payments.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No payments recorded yet.</p>
      ) : filtered.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No payments match this filter.</p>
      ) : (
        <Card className='py-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className='text-right'>Amount</TableHead>
                  <TableHead>Paid date</TableHead>
                  <TableHead className='hidden sm:table-cell'>Type</TableHead>
                  <TableHead className='hidden md:table-cell'>Method</TableHead>
                  <TableHead className='hidden md:table-cell'>Notes</TableHead>
                  {!readOnly && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginate(filtered, currentPage).map((p) => (
                  <PaymentRow key={p.id} payment={p} readOnly={readOnly} hasPhone={hasPhone} />
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
      <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
