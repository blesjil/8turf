'use client';

import { useActionState, useRef, useState } from 'react';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { ConfirmButton } from '@/components/confirm-button';

export interface Expense {
  id: string;
  category: 'repair' | 'cleaning' | 'tax' | 'other';
  amount: number;
  expense_date: string;
  remarks: string | null;
}

export interface ExpenseActionResult {
  error?: {
    category?: string[];
    amount?: string[];
    expenseDate?: string[];
    remarks?: string[];
    general?: string;
  };
}

const CATEGORY_LABELS: Record<Expense['category'], string> = {
  repair: 'Repair',
  cleaning: 'Cleaning',
  tax: 'Tax',
  other: 'Other',
};

function CategorySelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select
      name='category'
      defaultValue={defaultValue ?? 'repair'}
      className='px-3 py-2 border border-border rounded-lg'
    >
      <option value='repair'>Repair</option>
      <option value='cleaning'>Cleaning</option>
      <option value='tax'>Tax</option>
      <option value='other'>Other</option>
    </select>
  );
}

interface ExpenseRowProps {
  expense: Expense;
  updateAction: (
    prevState: ExpenseActionResult,
    formData: FormData,
  ) => Promise<ExpenseActionResult>;
  deleteAction: (formData: FormData) => Promise<void>;
}

function ExpenseRow({ expense, updateAction, deleteAction }: ExpenseRowProps) {
  const [state, formAction, isPending] = useActionState<ExpenseActionResult, FormData>(
    updateAction,
    {},
  );
  const [isEditing, setIsEditing] = useState(false);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  if (isEditing) {
    return (
      <tr className='border-b border-border/50'>
        <td colSpan={5} className='py-3'>
          <form action={formAction} className='flex flex-wrap gap-3 items-end'>
            <input type='hidden' name='id' value={expense.id} />
            {state.error?.general && (
              <p className='w-full text-sm text-red-600'>{state.error.general}</p>
            )}
            <div>
              <label className='block text-xs mb-1'>Date</label>
              <DatePickerField name='expenseDate' defaultValue={expense.expense_date} required />
              {state.error?.expenseDate && (
                <p className='mt-1 text-sm text-red-600'>{state.error.expenseDate[0]}</p>
              )}
            </div>
            <div>
              <label className='block text-xs mb-1'>Category</label>
              <CategorySelect defaultValue={expense.category} />
              {state.error?.category && (
                <p className='mt-1 text-sm text-red-600'>{state.error.category[0]}</p>
              )}
            </div>
            <div>
              <label className='block text-xs mb-1'>Amount (₱)</label>
              <input
                name='amountDollars'
                type='number'
                step='0.01'
                min='0.01'
                defaultValue={(expense.amount / 100).toFixed(2)}
                onChange={(e) => {
                  const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
                  const hidden = e.currentTarget.form?.elements.namedItem(
                    'amount',
                  ) as HTMLInputElement | null;
                  if (hidden) hidden.value = String(cents);
                }}
                className='px-3 py-2 border border-border rounded-lg'
              />
              <input type='hidden' name='amount' defaultValue={expense.amount} />
              {state.error?.amount && (
                <p className='mt-1 text-sm text-red-600'>{state.error.amount[0]}</p>
              )}
            </div>
            <div>
              <label className='block text-xs mb-1'>Remarks</label>
              <input
                name='remarks'
                defaultValue={expense.remarks ?? ''}
                placeholder='e.g. AC repair needed'
                className='px-3 py-2 border border-border rounded-lg'
              />
              {state.error?.remarks && (
                <p className='mt-1 text-sm text-red-600'>{state.error.remarks[0]}</p>
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
      <td className='py-2 pr-4'>{formatDate(expense.expense_date)}</td>
      <td className='py-2 pr-4'>{CATEGORY_LABELS[expense.category]}</td>
      <td className='py-2 pr-4'>{formatCents(expense.amount)}</td>
      <td className='py-2 pr-4'>{expense.remarks || '—'}</td>
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
            ref={deleteFormRef}
            action={async (formData) => {
              formData.set('id', expense.id);
              await deleteAction(formData);
            }}
          >
            <ConfirmButton
              formRef={deleteFormRef}
              message='Delete this expense? This cannot be undone.'
              confirmLabel='Delete'
              tone='danger'
              triggerClassName='text-red-600 hover:text-red-800 cursor-pointer'
            >
              Delete
            </ConfirmButton>
          </form>
        </div>
      </td>
    </tr>
  );
}

export function ExpenseList({
  parentIdField,
  parentId,
  expenses,
  recordAction,
  updateAction,
  deleteAction,
}: {
  parentIdField: 'propertyId' | 'unitId';
  parentId: string;
  expenses: Expense[];
  recordAction: (
    prevState: ExpenseActionResult,
    formData: FormData,
  ) => Promise<ExpenseActionResult>;
  updateAction: (
    prevState: ExpenseActionResult,
    formData: FormData,
  ) => Promise<ExpenseActionResult>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [state, formAction, isPending] = useActionState<ExpenseActionResult, FormData>(
    recordAction,
    {},
  );

  return (
    <div className='space-y-4'>
      <form action={formAction} className='flex flex-wrap gap-3 items-end'>
        <input type='hidden' name={parentIdField} value={parentId} />
        {state.error?.general && (
          <p className='w-full text-sm text-red-600'>{state.error.general}</p>
        )}
        <div>
          <label className='block text-xs mb-1'>Date</label>
          <DatePickerField name='expenseDate' required />
          {state.error?.expenseDate && (
            <p className='mt-1 text-sm text-red-600'>{state.error.expenseDate[0]}</p>
          )}
        </div>
        <div>
          <label className='block text-xs mb-1'>Category</label>
          <CategorySelect />
          {state.error?.category && (
            <p className='mt-1 text-sm text-red-600'>{state.error.category[0]}</p>
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
          <label className='block text-xs mb-1'>Remarks</label>
          <input
            name='remarks'
            placeholder='e.g. AC repair needed'
            className='px-3 py-2 border border-border rounded-lg'
          />
          {state.error?.remarks && (
            <p className='mt-1 text-sm text-red-600'>{state.error.remarks[0]}</p>
          )}
        </div>
        <button
          type='submit'
          disabled={isPending}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
        >
          {isPending ? 'Adding...' : 'Add Expense'}
        </button>
      </form>

      {expenses.length === 0 ? (
        <p className='text-foreground/60 text-sm'>No expenses recorded yet.</p>
      ) : (
        <table className='w-full text-sm border-collapse'>
          <thead>
            <tr className='text-left border-b border-border'>
              <th className='py-2 pr-4'>Date</th>
              <th className='py-2 pr-4'>Category</th>
              <th className='py-2 pr-4'>Amount</th>
              <th className='py-2 pr-4'>Remarks</th>
              <th className='py-2 pr-4'></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                updateAction={updateAction}
                deleteAction={deleteAction}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
