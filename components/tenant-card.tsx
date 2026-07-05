'use client';

import { useActionState } from 'react';
import { formatCents } from '@/lib/money';
import {
  endTenancy,
  assignTenant,
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
  is_active: number;
}

export function TenantCard({ unitId, tenant }: { unitId: string; tenant: Tenant | null }) {
  const [assignState, assignAction, assignPending] = useActionState<TenantActionResult, FormData>(
    assignTenant,
    {},
  );

  if (!tenant) {
    return (
      <div className='border border-border rounded-lg p-4'>
        <h3 className='font-semibold mb-3'>No tenant assigned</h3>
        <form action={assignAction} className='space-y-3'>
          <input type='hidden' name='unitId' value={unitId} />
          {assignState.error?.general && (
            <p className='text-sm text-red-600'>{assignState.error.general}</p>
          )}
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <input
                name='name'
                placeholder='Tenant name'
                required
                className='w-full px-3 py-2 border border-border rounded-lg'
              />
              {assignState.error?.name && (
                <p className='mt-1 text-sm text-red-600'>{assignState.error.name[0]}</p>
              )}
            </div>
            <div>
              <input
                name='email'
                type='email'
                placeholder='Email (optional)'
                className='w-full px-3 py-2 border border-border rounded-lg'
              />
              {assignState.error?.email && (
                <p className='mt-1 text-sm text-red-600'>{assignState.error.email[0]}</p>
              )}
            </div>
            <div>
              <input
                name='phone'
                placeholder='Phone (optional)'
                className='w-full px-3 py-2 border border-border rounded-lg'
              />
              {assignState.error?.phone && (
                <p className='mt-1 text-sm text-red-600'>{assignState.error.phone[0]}</p>
              )}
            </div>
            <div>
              <input
                name='rentAmountDollars'
                type='number'
                step='0.01'
                min='0'
                placeholder='Rent $/mo'
                required
                onChange={(e) => {
                  const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
                  const hidden = e.currentTarget.form?.elements.namedItem(
                    'rentAmount',
                  ) as HTMLInputElement | null;
                  if (hidden) hidden.value = String(cents);
                }}
                className='w-full px-3 py-2 border border-border rounded-lg'
              />
              <input type='hidden' name='rentAmount' />
              {assignState.error?.rentAmount && (
                <p className='mt-1 text-sm text-red-600'>{assignState.error.rentAmount[0]}</p>
              )}
            </div>
            <div>
              <input
                name='leaseStartDate'
                type='date'
                required
                className='w-full px-3 py-2 border border-border rounded-lg'
              />
              {assignState.error?.leaseStartDate && (
                <p className='mt-1 text-sm text-red-600'>{assignState.error.leaseStartDate[0]}</p>
              )}
            </div>
            <div>
              <input
                name='leaseEndDate'
                type='date'
                className='w-full px-3 py-2 border border-border rounded-lg'
              />
              {assignState.error?.leaseEndDate && (
                <p className='mt-1 text-sm text-red-600'>{assignState.error.leaseEndDate[0]}</p>
              )}
            </div>
          </div>
          <button
            type='submit'
            disabled={assignPending}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
          >
            {assignPending ? 'Assigning...' : 'Assign Tenant'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className='border border-border rounded-lg p-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h3 className='font-semibold'>{tenant.name}</h3>
          <p className='text-sm text-foreground/60'>
            {tenant.email || 'No email'} &middot; {tenant.phone || 'No phone'}
          </p>
          <p className='text-sm text-foreground/60'>
            Rent: {formatCents(tenant.rent_amount)}/mo &middot; Lease: {tenant.lease_start_date} to{' '}
            {tenant.lease_end_date || 'ongoing'}
          </p>
        </div>
        <form
          action={async (formData) => {
            formData.set('id', tenant.id);
            formData.set('leaseEndDate', new Date().toISOString().slice(0, 10));
            await endTenancy(formData);
          }}
        >
          <button type='submit' className='text-sm text-red-600 hover:text-red-800 cursor-pointer'>
            End Tenancy
          </button>
        </form>
      </div>
    </div>
  );
}
