'use client';

import { useActionState } from 'react';
import { formatCents } from '@/lib/money';
import {
  recordPayment,
  deletePayment,
  type PaymentActionResult,
} from '@/app/properties/[id]/units/[unitId]/actions';

export interface Payment {
  id: string;
  amount: number;
  period: string;
  paid_date: string;
  method: string | null;
  notes: string | null;
}

export function PaymentLedger({ tenantId, payments }: { tenantId: string; payments: Payment[] }) {
  const [state, formAction, isPending] = useActionState<PaymentActionResult, FormData>(
    recordPayment,
    {},
  );

  return (
    <div className='space-y-4'>
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
        </div>
        <div>
          <label className='block text-xs mb-1'>Amount ($)</label>
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
        </div>
        <div>
          <label className='block text-xs mb-1'>Paid Date</label>
          <input
            name='paidDate'
            type='date'
            required
            className='px-3 py-2 border border-border rounded-lg'
          />
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
        </div>
        <button
          type='submit'
          disabled={isPending}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
        >
          {isPending ? 'Recording...' : 'Record Payment'}
        </button>
      </form>

      {payments.length === 0 ? (
        <p className='text-foreground/60 text-sm'>No payments recorded yet.</p>
      ) : (
        <table className='w-full text-sm border-collapse'>
          <thead>
            <tr className='text-left border-b border-border'>
              <th className='py-2 pr-4'>Period</th>
              <th className='py-2 pr-4'>Amount</th>
              <th className='py-2 pr-4'>Paid Date</th>
              <th className='py-2 pr-4'>Method</th>
              <th className='py-2 pr-4'></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className='border-b border-border/50'>
                <td className='py-2 pr-4'>{p.period}</td>
                <td className='py-2 pr-4'>{formatCents(p.amount)}</td>
                <td className='py-2 pr-4'>{p.paid_date}</td>
                <td className='py-2 pr-4'>{p.method || '—'}</td>
                <td className='py-2 pr-4'>
                  <form
                    action={async (formData) => {
                      formData.set('id', p.id);
                      await deletePayment(formData);
                    }}
                  >
                    <button
                      type='submit'
                      className='text-red-600 hover:text-red-800 cursor-pointer'
                    >
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
