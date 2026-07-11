'use client';

import { useActionState, useState } from 'react';
import { format } from 'date-fns';
import { PlusIcon, XIcon } from 'lucide-react';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { TenantDocuments, type TenantDocument } from '@/components/tenant-documents';
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
  deposit_amount: number;
  lease_start_date: string;
  lease_end_date: string | null;
  is_active: boolean;
  occupants: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

const MAX_OCCUPANTS = 10;

function OccupantsField({ initial, error }: { initial?: string[]; error?: string[] }) {
  const [rows, setRows] = useState<{ key: number; value: string }[]>(() =>
    (initial ?? []).map((value, i) => ({ key: i, value })),
  );
  const [nextKey, setNextKey] = useState((initial ?? []).length);

  const addRow = () => {
    setRows((prev) => [...prev, { key: nextKey, value: '' }]);
    setNextKey((k) => k + 1);
  };

  return (
    <div className='sm:col-span-2'>
      <Label className='mb-2'>
        Other occupants <span className='font-normal text-muted-foreground'>(optional)</span>
      </Label>
      {rows.length > 0 && (
        <div className='mb-2 space-y-2'>
          {rows.map((row, i) => (
            <div key={row.key} className='flex items-center gap-2'>
              <Input
                name='occupants'
                value={row.value}
                placeholder='Occupant name'
                aria-label={`Occupant ${i + 1}`}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, value } : r)));
                }}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon-lg'
                className='shrink-0'
                onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
              >
                <XIcon />
                <span className='sr-only'>Remove occupant {i + 1}</span>
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={addRow}
        disabled={rows.length >= MAX_OCCUPANTS}
      >
        <PlusIcon /> Add occupant
      </Button>
      <FieldError messages={error} />
    </div>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className='mt-1 text-sm text-destructive'>{messages[0]}</p>;
}

function TenantFormFields({
  state,
  tenant,
  defaultRentAmount,
  formData,
}: {
  state: TenantActionResult;
  tenant?: Tenant | null;
  defaultRentAmount?: number;
  formData?: Record<string, string>;
}) {
  const prefillRent = tenant?.rent_amount ?? defaultRentAmount;
  const prefillDeposit = tenant?.deposit_amount ?? prefillRent;

  const getValue = (key: string, defaultVal: string = '') => {
    return formData?.[key] ?? (tenant?.[key as keyof Tenant] as string) ?? defaultVal;
  };

  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <div>
        <Label htmlFor='tenant-name' className='mb-2'>
          Name
        </Label>
        <Input id='tenant-name' name='name' defaultValue={getValue('name')} required />
        <FieldError messages={state.error?.name} />
      </div>
      <div>
        <Label htmlFor='tenant-email' className='mb-2'>
          Email <span className='font-normal text-muted-foreground'>(optional)</span>
        </Label>
        <Input id='tenant-email' name='email' type='email' defaultValue={getValue('email')} />
        <FieldError messages={state.error?.email} />
      </div>
      <div>
        <Label htmlFor='tenant-phone' className='mb-2'>
          Phone <span className='font-normal text-muted-foreground'>(optional)</span>
        </Label>
        <Input id='tenant-phone' name='phone' defaultValue={getValue('phone')} />
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
          defaultValue={
            formData?.rentAmountDollars != null
              ? formData.rentAmountDollars
              : prefillRent != null
                ? (prefillRent / 100).toFixed(2)
                : undefined
          }
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
        <Label htmlFor='tenant-deposit' className='mb-2'>
          Deposit (₱)
        </Label>
        <Input
          id='tenant-deposit'
          name='depositAmountDollars'
          type='number'
          step='0.01'
          min='0'
          defaultValue={
            formData?.depositAmountDollars != null
              ? formData.depositAmountDollars
              : prefillDeposit != null
                ? (prefillDeposit / 100).toFixed(2)
                : undefined
          }
          required
          onChange={(e) => {
            const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
            const hidden = e.currentTarget.form?.elements.namedItem(
              'depositAmount',
            ) as HTMLInputElement | null;
            if (hidden) hidden.value = String(cents);
          }}
        />
        <input type='hidden' name='depositAmount' defaultValue={prefillDeposit} />
        <FieldError messages={state.error?.depositAmount} />
      </div>
      <div>
        <Label className='mb-2'>Lease start</Label>
        <DatePickerField
          name='leaseStartDate'
          defaultValue={getValue('leaseStartDate', tenant?.lease_start_date)}
          required
        />
        <FieldError messages={state.error?.leaseStartDate} />
      </div>
      <div>
        <Label className='mb-2'>
          Lease end <span className='font-normal text-muted-foreground'>(optional)</span>
        </Label>
        <DatePickerField
          name='leaseEndDate'
          defaultValue={formData?.leaseEndDate ?? tenant?.lease_end_date ?? undefined}
        />
        <FieldError messages={state.error?.leaseEndDate} />
      </div>
      <OccupantsField initial={tenant?.occupants} error={state.error?.occupants} />
      <div>
        <Label htmlFor='tenant-emergency-name' className='mb-2'>
          Emergency contact <span className='font-normal text-muted-foreground'>(optional)</span>
        </Label>
        <Input
          id='tenant-emergency-name'
          name='emergencyContactName'
          placeholder='Contact person'
          defaultValue={getValue('emergencyContactName', tenant?.emergency_contact_name ?? '')}
        />
        <FieldError messages={state.error?.emergencyContactName} />
      </div>
      <div>
        <Label htmlFor='tenant-emergency-phone' className='mb-2'>
          Emergency phone <span className='font-normal text-muted-foreground'>(optional)</span>
        </Label>
        <Input
          id='tenant-emergency-phone'
          name='emergencyContactPhone'
          type='tel'
          placeholder='09XX XXX XXXX'
          defaultValue={getValue('emergencyContactPhone', tenant?.emergency_contact_phone ?? '')}
        />
        <FieldError messages={state.error?.emergencyContactPhone} />
      </div>
    </div>
  );
}

export function TenantCard({
  unitId,
  tenant,
  askingRent,
  documents = [],
  documentsEnabled = false,
}: {
  unitId: string;
  tenant: Tenant | null;
  askingRent?: number;
  documents?: TenantDocument[];
  documentsEnabled?: boolean;
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
  const [endDateError, setEndDateError] = useState<string | null>(null);
  const [lastAssignFormData, setLastAssignFormData] = useState<Record<string, string>>({});
  const [lastUpdateFormData, setLastUpdateFormData] = useState<Record<string, string>>({});

  const handleAssignSubmit = async (formData: FormData) => {
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      if (typeof value === 'string') data[key] = value;
    });
    setLastAssignFormData(data);
    await assignAction(formData);
  };

  const handleUpdateSubmit = async (formData: FormData) => {
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      if (typeof value === 'string') data[key] = value;
    });
    setLastUpdateFormData(data);
    await updateAction(formData);
  };

  if (!tenant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No tenant assigned</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleAssignSubmit} className='space-y-4'>
            <input type='hidden' name='unitId' value={unitId} />
            {assignState.error?.general && (
              <p className='text-sm text-destructive'>{assignState.error.general}</p>
            )}
            <TenantFormFields
              state={assignState}
              defaultRentAmount={askingRent}
              formData={lastAssignFormData}
            />
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
          <form action={handleUpdateSubmit} className='space-y-4'>
            <input type='hidden' name='id' value={tenant.id} />
            {updateState.error?.general && (
              <p className='text-sm text-destructive'>{updateState.error.general}</p>
            )}
            <TenantFormFields state={updateState} tenant={tenant} formData={lastUpdateFormData} />
            <div className='flex gap-2'>
              <Button type='submit' disabled={updatePending}>
                {updatePending ? 'Saving…' : 'Save changes'}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setIsEditing(false);
                  setLastUpdateFormData({});
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
          <div className='mt-6'>
            <TenantDocuments
              tenantId={tenant.id}
              documents={documents}
              enabled={documentsEnabled}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className='space-y-4'>
        <div className='flex items-start justify-between gap-4'>
          <div className='space-y-1'>
            <h3 className='font-semibold'>{tenant.name}</h3>
            <p className='text-sm text-muted-foreground'>
              {tenant.email || 'No email'} · {tenant.phone || 'No phone'}
            </p>
            <p className='text-sm text-muted-foreground'>
              Rent: <span className='font-mono'>{formatCents(tenant.rent_amount)}</span>/mo ·
              Deposit: <span className='font-mono'>{formatCents(tenant.deposit_amount)}</span> ·
              Lease:{' '}
              {formatDate(tenant.lease_start_date)} to{' '}
              {tenant.lease_end_date ? formatDate(tenant.lease_end_date) : 'ongoing'}
            </p>
            {tenant.occupants?.length > 0 && (
              <p className='text-sm text-muted-foreground'>With: {tenant.occupants.join(', ')}</p>
            )}
            {(tenant.emergency_contact_name || tenant.emergency_contact_phone) && (
              <p className='text-sm text-muted-foreground'>
                Emergency:{' '}
                {[tenant.emergency_contact_name, tenant.emergency_contact_phone]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
          <div className='flex shrink-0 items-center gap-2'>
            <Button type='button' variant='outline' size='sm' onClick={() => setIsEditing(true)}>
              Edit
            </Button>
            <AlertDialog onOpenChange={() => setEndDateError(null)}>
              <AlertDialogTrigger render={<Button type='button' variant='destructive' size='sm' />}>
                End tenancy
              </AlertDialogTrigger>
              <AlertDialogContent>
                <form
                  action={async (formData) => {
                    const leaseEndDate = formData.get('leaseEndDate');
                    if (!leaseEndDate) {
                      setEndDateError('Lease end date is required.');
                      return;
                    }
                    formData.set('id', tenant.id);
                    const result = await endTenancy(formData);
                    if (result?.error) {
                      setEndDateError(result.error);
                    }
                  }}
                  className='grid gap-4'
                >
                  <AlertDialogHeader>
                    <AlertDialogTitle>End tenancy</AlertDialogTitle>
                    <AlertDialogDescription>
                      End {tenant.name}&rsquo;s tenancy? The unit will be marked vacant. This cannot
                      be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div>
                    <Label className='mb-2'>Lease end date</Label>
                    <DatePickerField
                      name='leaseEndDate'
                      defaultValue={tenant.lease_end_date ?? format(new Date(), 'yyyy-MM-dd')}
                      required
                    />
                    {endDateError && (
                      <p className='mt-1 text-sm text-destructive'>{endDateError}</p>
                    )}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction type='submit' variant='destructive'>
                      End tenancy
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </form>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <TenantDocuments tenantId={tenant.id} documents={documents} enabled={documentsEnabled} />
      </CardContent>
    </Card>
  );
}
