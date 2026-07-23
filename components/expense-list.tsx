'use client';

import { useActionState, useRef, useState } from 'react';
import { formatCents } from '@/lib/money';
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

export interface Expense {
  id: string;
  category: 'repair' | 'cleaning' | 'tax' | 'pub' | 'internet' | 'other';
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
  pub: 'PUB',
  internet: 'Internet',
  other: 'Other',
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className='mt-1 text-sm text-destructive'>{messages[0]}</p>;
}

function ExpenseFormFields({ state, expense }: { state: ExpenseActionResult; expense?: Expense }) {
  return (
    <>
      <div className='w-full sm:w-auto'>
        <Label className='mb-2 text-xs'>Date</Label>
        <DatePickerField name='expenseDate' defaultValue={expense?.expense_date} required />
        <FieldError messages={state.error?.expenseDate} />
      </div>
      <div className='w-full sm:w-auto'>
        <Label className='mb-2 text-xs'>Category</Label>
        <NativeSelect name='category' defaultValue={expense?.category ?? 'repair'}>
          <option value='repair'>Repair</option>
          <option value='cleaning'>Cleaning</option>
          <option value='tax'>Tax</option>
          <option value='pub'>PUB</option>
          <option value='internet'>Internet</option>
          <option value='other'>Other</option>
        </NativeSelect>
        <FieldError messages={state.error?.category} />
      </div>
      <div className='w-full sm:w-auto'>
        <Label className='mb-2 text-xs'>Amount (₱)</Label>
        <Input
          name='amountDollars'
          type='number'
          step='0.01'
          min='0.01'
          defaultValue={expense ? (expense.amount / 100).toFixed(2) : undefined}
          required={!expense}
          className='w-full sm:w-32'
          onChange={(e) => {
            const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
            const hidden = e.currentTarget.form?.elements.namedItem(
              'amount',
            ) as HTMLInputElement | null;
            if (hidden) hidden.value = String(cents);
          }}
        />
        <input type='hidden' name='amount' defaultValue={expense?.amount} />
        <FieldError messages={state.error?.amount} />
      </div>
      <div className='w-full sm:w-auto'>
        <Label className='mb-2 text-xs'>Remarks</Label>
        <Input
          name='remarks'
          defaultValue={expense?.remarks ?? ''}
          placeholder='e.g. AC repair needed'
          className='w-full sm:w-48'
        />
        <FieldError messages={state.error?.remarks} />
      </div>
    </>
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
      <TableRow>
        <TableCell colSpan={5} className='py-3'>
          <form action={formAction} className='flex flex-wrap items-end gap-3'>
            <input type='hidden' name='id' value={expense.id} />
            {state.error?.general && (
              <p className='w-full text-sm text-destructive'>{state.error.general}</p>
            )}
            <ExpenseFormFields state={state} expense={expense} />
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
      <TableCell>{formatDate(expense.expense_date)}</TableCell>
      <TableCell>{CATEGORY_LABELS[expense.category]}</TableCell>
      <TableCell className='text-right font-mono tabular-nums'>
        {formatCents(expense.amount)}
      </TableCell>
      <TableCell className='hidden max-w-48 truncate md:table-cell'>
        {expense.remarks || '—'}
      </TableCell>
      <TableCell>
        <div className='flex items-center justify-end gap-1'>
          <Button type='button' variant='ghost' size='sm' onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <form
            ref={deleteFormRef}
            action={async (formData) => {
              formData.set('id', expense.id);
              await deleteAction(formData);
            }}
          >
            <ConfirmButton
              formRef={deleteFormRef}
              title='Delete expense'
              message='Delete this expense? This cannot be undone.'
              confirmLabel='Delete'
              tone='danger'
              triggerClassName='text-destructive hover:text-destructive'
            >
              Delete
            </ConfirmButton>
          </form>
        </div>
      </TableCell>
    </TableRow>
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
  const [page, setPage] = useState(1);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');

  const years = [...new Set(expenses.map((e) => e.expense_date.slice(0, 4)))].sort().reverse();
  const filtered = expenses.filter(
    (e) =>
      (!year || e.expense_date.slice(0, 4) === year) &&
      (!month || e.expense_date.slice(5, 7) === month),
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(totalPages, 1));

  return (
    <div className='space-y-4'>
      <Card className='p-4'>
        <form action={formAction} className='flex flex-wrap items-end gap-3'>
          <input type='hidden' name={parentIdField} value={parentId} />
          {state.error?.general && (
            <p className='w-full text-sm text-destructive'>{state.error.general}</p>
          )}
          <ExpenseFormFields state={state} />
          <Button type='submit' disabled={isPending}>
            {isPending ? 'Adding…' : 'Add expense'}
          </Button>
        </form>
      </Card>

      {expenses.length > 0 && (
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

      {expenses.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No expenses recorded yet.</p>
      ) : filtered.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No expenses match this filter.</p>
      ) : (
        <Card className='py-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className='text-right'>Amount</TableHead>
                  <TableHead className='hidden md:table-cell'>Remarks</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginate(filtered, currentPage).map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    updateAction={updateAction}
                    deleteAction={deleteAction}
                  />
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
