'use client';

import { useActionState, useState } from 'react';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePickerField } from '@/components/ui/date-picker-field';
import {
  endTenancy,
  assignTenant,
  updateTenant,
  type TenantActionResult,
} from '@/app/properties/[id]/units/[unitId]/actions';

export interface Tenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rent_amount: number;
  lease_start_date: string;
  lease_end_date: string | null;
  is_active: boolean;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className='mt-1 text-sm text-destructive'>{messages[0]}</p>;
}

function TenantFormFields({
  state,
  tenant,
  defaultRentAmount,
}: {
  state: TenantActionResult;
  tenant?: Tenant | null;
  defaultRentAmount?: number;
}) {
  const prefillRent = tenant?.rent_amount ?? defaultRentAmount;
  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <div>
        <Label htmlFor='tenant-name' className='mb-2'>
          Name
        </Label>
        <Input id='tenant-name' name='name' defaultValue={tenant?.name} required />
        <FieldError messages={state.error?.name} />
      </div>
      <div>
        <Label htmlFor='tenant-email' className='mb-2'>
          Email <span className='font-normal text-muted-foreground'>(optional)</span>
        </Label>
        <Input id='tenant-email' name='email' type='email' defaultValue={tenant?.email ?? ''} />
        <FieldError messages={state.error?.email} />
      </div>
      <div>
        <Label htmlFor='tenant-phone' className='mb-2'>
          Phone <span className='font-normal text-muted-foreground'>(optional)</span>
        </Label>
        <Input id='tenant-phone' name='phone' defaultValue={tenant?.phone ?? ''} />
        <FieldError messages={state.error?.phone} />
      </div>
      <div>
        <Label htmlFor='tenant-rent' className='mb-2'>
          Rent (₱/mo)
        </Label>
        <Input
          id='tenant-rent'
          name='rentAmountDollars'
          type='number'
          step='0.01'
          min='0'
          defaultValue={prefillRent != null ? (prefillRent / 100).toFixed(2) : undefined}
          required
          onChange={(e) => {
            const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
            const hidden = e.currentTarget.form?.elements.namedItem(
              'rentAmount',
            ) as HTMLInputElement | null;
            if (hidden) hidden.value = String(cents);
          }}
        />
        <input type='hidden' name='rentAmount' defaultValue={prefillRent} />
        <FieldError messages={state.error?.rentAmount} />
      </div>
      <div>
        <Label className='mb-2'>Lease start</Label>
        <DatePickerField name='leaseStartDate' defaultValue={tenant?.lease_start_date} required />
        <FieldError messages={state.error?.leaseStartDate} />
      </div>
      <div>
        <Label className='mb-2'>
          Lease end <span className='font-normal text-muted-foreground'>(optional)</span>
        </Label>
        <DatePickerField name='leaseEndDate' defaultValue={tenant?.lease_end_date ?? undefined} />
        <FieldError messages={state.error?.leaseEndDate} />
      </div>
    </div>
  );
}

export function TenantCard({
  unitId,
  tenant,
  askingRent,
}: {
  unitId: string;
  tenant: Tenant | null;
  askingRent?: number;
}) {
  const [assignState, assignAction, assignPending] = useActionState<TenantActionResult, FormData>(
    assignTenant,
    {},
  );
  const [updateState, updateAction, updatePending] = useActionState<TenantActionResult, FormData>(
    updateTenant,
    {},
  );
  const [isEditing, setIsEditing] = useState(false);

  if (!tenant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No tenant assigned</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={assignAction} className='space-y-4'>
            <input type='hidden' name='unitId' value={unitId} />
            {assignState.error?.general && (
              <p className='text-sm text-destructive'>{assignState.error.general}</p>
            )}
            <TenantFormFields state={assignState} defaultRentAmount={askingRent} />
            <Button type='submit' disabled={assignPending}>
              {assignPending ? 'Assigning…' : 'Assign tenant'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className='space-y-4'>
            <input type='hidden' name='id' value={tenant.id} />
            {updateState.error?.general && (
              <p className='text-sm text-destructive'>{updateState.error.general}</p>
            )}
            <TenantFormFields state={updateState} tenant={tenant} />
            <div className='flex gap-2'>
              <Button type='submit' disabled={updatePending}>
                {updatePending ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type='button' variant='outline' onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className='flex items-start justify-between gap-4'>
        <div className='space-y-1'>
          <h3 className='font-semibold'>{tenant.name}</h3>
          <p className='text-sm text-muted-foreground'>
            {tenant.email || 'No email'} · {tenant.phone || 'No phone'}
          </p>
          <p className='text-sm text-muted-foreground'>
            Rent: <span className='font-mono'>{formatCents(tenant.rent_amount)}</span>/mo · Lease:{' '}
            {formatDate(tenant.lease_start_date)} to{' '}
            {tenant.lease_end_date ? formatDate(tenant.lease_end_date) : 'ongoing'}
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Button type='button' variant='outline' size='sm' onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <form
            action={async (formData) => {
              formData.set('id', tenant.id);
              formData.set('leaseEndDate', new Date().toISOString().slice(0, 10));
              await endTenancy(formData);
            }}
          >
            <Button type='submit' variant='destructive' size='sm'>
              End tenancy
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
