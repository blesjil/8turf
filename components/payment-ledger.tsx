'use client';

import { useActionState, useState } from 'react';
import { formatCents } from '@/lib/money';
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

function PaymentRow({ payment, readOnly }: { payment: Payment; readOnly?: boolean }) {
  const [state, formAction, isPending] = useActionState<PaymentActionResult, FormData>(
    updatePayment,
    {},
  );
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <tr className='border-b border-border/50'>
        <td colSpan={7} className='py-3'>
          <form action={formAction} className='flex flex-wrap gap-3 items-end'>
            <input type='hidden' name='id' value={payment.id} />
            {state.error?.general && (
              <p className='w-full text-sm text-red-600'>{state.error.general}</p>
            )}
            <div>
              <label className='block text-xs mb-1'>Period</label>
              <input
                name='period'
                type='month'
                defaultValue={payment.period}
                required
                className='px-3 py-2 border border-border rounded-lg'
              />
              {state.error?.period && (
                <p className='mt-1 text-sm text-red-600'>{state.error.period[0]}</p>
              )}
            </div>
            <div>
              <label className='block text-xs mb-1'>Amount (₱)</label>
              <input
                name='amountDollars'
                type='number'
                step='0.01'
                min='0.01'
                defaultValue={(payment.amount / 100).toFixed(2)}
                onChange={(e) => {
                  const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
                  const hidden = e.currentTarget.form?.elements.namedItem(
                    'amount',
                  ) as HTMLInputElement | null;
                  if (hidden) hidden.value = String(cents);
                }}
                className='px-3 py-2 border border-border rounded-lg'
              />
              <input type='hidden' name='amount' defaultValue={payment.amount} />
              {state.error?.amount && (
                <p className='mt-1 text-sm text-red-600'>{state.error.amount[0]}</p>
              )}
            </div>
            <div>
              <label className='block text-xs mb-1'>Paid Date</label>
              <input
                name='paidDate'
                type='date'
                defaultValue={payment.paid_date}
                required
                className='px-3 py-2 border border-border rounded-lg'
              />
              {state.error?.paidDate && (
                <p className='mt-1 text-sm text-red-600'>{state.error.paidDate[0]}</p>
              )}
            </div>
            <div>
              <label className='block text-xs mb-1'>Type</label>
              <select
                name='paymentType'
                defaultValue={payment.payment_type}
                className='px-3 py-2 border border-border rounded-lg'
              >
                <option value='rental'>Rental</option>
                <option value='deposit'>Deposit</option>
                <option value='advance'>Advance</option>
                <option value='reservation'>Reservation</option>
              </select>
              {state.error?.paymentType && (
                <p className='mt-1 text-sm text-red-600'>{state.error.paymentType[0]}</p>
              )}
            </div>
            <div>
              <label className='block text-xs mb-1'>Method</label>
              <select
                name='method'
                defaultValue={payment.method ?? ''}
                className='px-3 py-2 border border-border rounded-lg'
              >
                <option value=''>—</option>
                <option value='cash'>Cash</option>
                <option value='bank_transfer'>Bank Transfer</option>
                <option value='check'>Check</option>
                <option value='other'>Other</option>
              </select>
              {state.error?.method && (
                <p className='mt-1 text-sm text-red-600'>{state.error.method[0]}</p>
              )}
            </div>
            <div>
              <label className='block text-xs mb-1'>Notes</label>
              <input
                name='notes'
                defaultValue={payment.notes ?? ''}
                className='px-3 py-2 border border-border rounded-lg'
              />
              {state.error?.notes && (
                <p className='mt-1 text-sm text-red-600'>{state.error.notes[0]}</p>
              )}
            </div>
            <button
              type='submit'
              disabled={isPending}
              className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
            >
              {isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              type='button'
              onClick={() => setIsEditing(false)}
              className='px-4 py-2 border border-border rounded-lg hover:bg-black/5'
            >
              Cancel
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className='border-b border-border/50'>
      <td className='py-2 pr-4'>{payment.period}</td>
      <td className='py-2 pr-4'>{formatCents(payment.amount)}</td>
      <td className='py-2 pr-4'>{payment.paid_date}</td>
      <td className='py-2 pr-4'>{TYPE_LABELS[payment.payment_type]}</td>
      <td className='py-2 pr-4'>{payment.method || '—'}</td>
      <td className='py-2 pr-4'>{payment.notes || '—'}</td>
      {!readOnly && (
        <td className='py-2 pr-4'>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => setIsEditing(true)}
              className='text-blue-600 hover:text-blue-800 cursor-pointer'
            >
              Edit
            </button>
            <form
              action={async (formData) => {
                formData.set('id', payment.id);
                await deletePayment(formData);
              }}
            >
              <button type='submit' className='text-red-600 hover:text-red-800 cursor-pointer'>
                Delete
              </button>
            </form>
          </div>
        </td>
      )}
    </tr>
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
        <form action={formAction} className='flex flex-wrap gap-3 items-end'>
          <input type='hidden' name='tenantId' value={tenantId} />
          {state.error?.general && (
            <p className='w-full text-sm text-red-600'>{state.error.general}</p>
          )}
          <div>
            <label className='block text-xs mb-1'>Period</label>
            <input
              name='period'
              type='month'
              required
              className='px-3 py-2 border border-border rounded-lg'
            />
            {state.error?.period && (
              <p className='mt-1 text-sm text-red-600'>{state.error.period[0]}</p>
            )}
          </div>
          <div>
            <label className='block text-xs mb-1'>Amount (₱)</label>
            <input
              name='amountDollars'
              type='number'
              step='0.01'
              min='0.01'
              required
              onChange={(e) => {
                const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
                const hidden = e.currentTarget.form?.elements.namedItem(
                  'amount',
                ) as HTMLInputElement | null;
                if (hidden) hidden.value = String(cents);
              }}
              className='px-3 py-2 border border-border rounded-lg'
            />
            <input type='hidden' name='amount' />
            {state.error?.amount && (
              <p className='mt-1 text-sm text-red-600'>{state.error.amount[0]}</p>
            )}
          </div>
          <div>
            <label className='block text-xs mb-1'>Paid Date</label>
            <input
              name='paidDate'
              type='date'
              required
              className='px-3 py-2 border border-border rounded-lg'
            />
            {state.error?.paidDate && (
              <p className='mt-1 text-sm text-red-600'>{state.error.paidDate[0]}</p>
            )}
          </div>
          <div>
            <label className='block text-xs mb-1'>Type</label>
            <select
              name='paymentType'
              defaultValue='rental'
              className='px-3 py-2 border border-border rounded-lg'
            >
              <option value='rental'>Rental</option>
              <option value='deposit'>Deposit</option>
              <option value='advance'>Advance</option>
              <option value='reservation'>Reservation</option>
            </select>
            {state.error?.paymentType && (
              <p className='mt-1 text-sm text-red-600'>{state.error.paymentType[0]}</p>
            )}
          </div>
          <div>
            <label className='block text-xs mb-1'>Method</label>
            <select name='method' className='px-3 py-2 border border-border rounded-lg'>
              <option value=''>—</option>
              <option value='cash'>Cash</option>
              <option value='bank_transfer'>Bank Transfer</option>
              <option value='check'>Check</option>
              <option value='other'>Other</option>
            </select>
            {state.error?.method && (
              <p className='mt-1 text-sm text-red-600'>{state.error.method[0]}</p>
            )}
          </div>
          <div>
            <label className='block text-xs mb-1'>Notes</label>
            <input name='notes' className='px-3 py-2 border border-border rounded-lg' />
            {state.error?.notes && (
              <p className='mt-1 text-sm text-red-600'>{state.error.notes[0]}</p>
            )}
          </div>
          <button
            type='submit'
            disabled={isPending}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
          >
            {isPending ? 'Recording...' : 'Record Payment'}
          </button>
        </form>
      )}

      {payments.length === 0 ? (
        <p className='text-foreground/60 text-sm'>No payments recorded yet.</p>
      ) : (
        <table className='w-full text-sm border-collapse'>
          <thead>
            <tr className='text-left border-b border-border'>
              <th className='py-2 pr-4'>Period</th>
              <th className='py-2 pr-4'>Amount</th>
              <th className='py-2 pr-4'>Paid Date</th>
              <th className='py-2 pr-4'>Type</th>
              <th className='py-2 pr-4'>Method</th>
              <th className='py-2 pr-4'>Notes</th>
              {!readOnly && <th className='py-2 pr-4'></th>}
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <PaymentRow key={p.id} payment={p} readOnly={readOnly} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
