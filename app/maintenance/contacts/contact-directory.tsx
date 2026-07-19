'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  WrenchIcon,
  XIcon,
} from 'lucide-react';
import {
  createMaintenanceContact,
  setMaintenanceContactArchived,
  setMaintenanceContactPreferred,
  updateMaintenanceContact,
  type MaintenanceContactActionResult,
} from './actions';
import {
  MAINTENANCE_SERVICES,
  MAINTENANCE_SERVICE_LABELS,
  type MaintenanceContact,
} from '@/lib/maintenance-contacts';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { ConfirmButton } from '@/components/confirm-button';
import { PaginationNav } from '@/components/ui/pagination';

export interface ContactOwnerOption {
  id: string;
  name: string;
  email: string;
}

interface DirectoryFilters extends Record<string, string | undefined> {
  q?: string;
  service?: string;
  preferred?: string;
  status?: string;
  owner?: string;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className='mt-1 text-xs text-destructive'>{messages[0]}</p>;
}

function ContactFormFields({
  contact,
  owners,
  currentUserId,
  state,
  prefix,
}: {
  contact?: MaintenanceContact;
  owners?: ContactOwnerOption[];
  currentUserId: string;
  state: MaintenanceContactActionResult;
  prefix: string;
}) {
  return (
    <div className='space-y-5 overflow-y-auto px-4 pb-4'>
      {state.error?.general && (
        <Alert variant='destructive'>
          <AlertTitle>{state.error.general}</AlertTitle>
        </Alert>
      )}

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor={`${prefix}-name`}>Name</Label>
          <Input
            id={`${prefix}-name`}
            name='name'
            defaultValue={contact?.name}
            placeholder='e.g. Mario Santos'
            required
          />
          <FieldError messages={state.error?.name} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor={`${prefix}-company`}>Company</Label>
          <Input
            id={`${prefix}-company`}
            name='company'
            defaultValue={contact?.company ?? ''}
            placeholder='Optional'
          />
          <FieldError messages={state.error?.company} />
        </div>
      </div>

      <fieldset className='space-y-2'>
        <legend className='text-sm font-medium'>Services</legend>
        <div className='grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-3'>
          {MAINTENANCE_SERVICES.map((service) => (
            <Label key={service.value} className='min-h-7 cursor-pointer text-xs font-normal'>
              <input
                type='checkbox'
                name='services'
                value={service.value}
                defaultChecked={contact?.services.includes(service.value)}
                className='size-4 accent-primary'
              />
              {service.label}
            </Label>
          ))}
        </div>
        <FieldError messages={state.error?.services} />
      </fieldset>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor={`${prefix}-phone`}>Phone</Label>
          <Input
            id={`${prefix}-phone`}
            name='phone'
            type='tel'
            defaultValue={contact?.phone ?? ''}
            placeholder='e.g. 0917 123 4567'
          />
          <FieldError messages={state.error?.phone} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor={`${prefix}-email`}>Email</Label>
          <Input
            id={`${prefix}-email`}
            name='email'
            type='email'
            defaultValue={contact?.email ?? ''}
            placeholder='Optional'
          />
          <FieldError messages={state.error?.email} />
        </div>
      </div>
      <p className='-mt-3 text-xs text-muted-foreground'>
        Add at least a phone number or email address.
      </p>

      <div className='space-y-2'>
        <Label htmlFor={`${prefix}-area`}>Service area</Label>
        <Input
          id={`${prefix}-area`}
          name='serviceArea'
          defaultValue={contact?.service_area ?? ''}
          placeholder='e.g. Cagayan and nearby towns'
        />
        <FieldError messages={state.error?.serviceArea} />
      </div>

      <div className='space-y-2'>
        <Label htmlFor={`${prefix}-availability`}>Availability</Label>
        <Input
          id={`${prefix}-availability`}
          name='availability'
          defaultValue={contact?.availability ?? ''}
          placeholder='e.g. Mon–Sat, 8am–6pm'
        />
        <FieldError messages={state.error?.availability} />
      </div>

      <div className='space-y-2'>
        <Label htmlFor={`${prefix}-notes`}>Notes</Label>
        <Textarea
          id={`${prefix}-notes`}
          name='notes'
          defaultValue={contact?.notes ?? ''}
          placeholder='Rates, specialties, or useful reminders'
          rows={4}
        />
        <FieldError messages={state.error?.notes} />
      </div>

      {!contact && owners && owners.length > 0 && (
        <div className='space-y-2'>
          <Label htmlFor={`${prefix}-owner`}>Owner</Label>
          <NativeSelect id={`${prefix}-owner`} name='ownerId' defaultValue={currentUserId}>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} ({owner.email})
              </option>
            ))}
          </NativeSelect>
          <FieldError messages={state.error?.ownerId} />
        </div>
      )}

      <Label className='cursor-pointer rounded-lg border border-border p-3 font-normal'>
        <input
          type='checkbox'
          name='isPreferred'
          defaultChecked={contact?.is_preferred}
          className='size-4 accent-primary'
        />
        <span>
          <span className='block font-medium'>Preferred contact</span>
          <span className='text-xs text-muted-foreground'>
            Show this contact first in the list.
          </span>
        </span>
      </Label>
    </div>
  );
}

function ContactFormBody({
  contact,
  owners,
  currentUserId,
  onClose,
}: {
  contact?: MaintenanceContact;
  owners?: ContactOwnerOption[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<MaintenanceContactActionResult, FormData>(
    contact ? updateMaintenanceContact : createMaintenanceContact,
    {},
  );
  const generatedId = useId().replaceAll(':', '');
  const prefix = `${contact ? 'edit' : 'add'}-${contact?.id ?? generatedId}`;

  if (state.success) {
    return (
      <div className='grid flex-1 place-items-center p-6 text-center'>
        <div>
          <span className='mx-auto mb-3 grid size-11 place-items-center rounded-full bg-success-muted text-primary'>
            <WrenchIcon className='size-5' />
          </span>
          <h3 className='font-heading text-lg font-semibold'>Contact saved</h3>
          <p className='mt-1 text-sm text-muted-foreground'>
            The maintenance directory has been updated.
          </p>
          <Button type='button' className='mt-4' onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className='flex min-h-0 flex-1 flex-col'>
      {contact && <input type='hidden' name='id' value={contact.id} />}
      <div className='flex flex-col gap-0.5 border-b border-border p-4 pr-12'>
        <h2 className='font-heading text-base font-medium'>
          {contact ? 'Edit maintenance contact' : 'Add maintenance contact'}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {contact
            ? 'Update this contractor’s services and contact details.'
            : 'Save a contractor so they are easy to find when maintenance is needed.'}
        </p>
      </div>
      <ContactFormFields
        contact={contact}
        owners={owners}
        currentUserId={currentUserId}
        state={state}
        prefix={prefix}
      />
      <div className='mt-auto flex flex-col gap-2 border-t border-border bg-card p-4'>
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Saving…' : contact ? 'Save changes' : 'Add contact'}
        </Button>
        <Button type='button' variant='outline' onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ContactFormSheet({
  contact,
  owners,
  currentUserId,
  compact = false,
}: {
  contact?: MaintenanceContact;
  owners?: ContactOwnerOption[];
  currentUserId: string;
  compact?: boolean;
}) {
  const [formKey, setFormKey] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setFormKey((key) => key + 1);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const frame = requestAnimationFrame(() => {
      const initialFocus =
        panelRef.current?.querySelector<HTMLElement>('input[name="name"]') ??
        panelRef.current?.querySelector<HTMLElement>('button');
      initialFocus?.focus();
    });
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setFormKey((key) => key + 1);
  };

  return (
    <>
      <button
        type='button'
        className={buttonVariants({
          variant: contact ? 'ghost' : 'default',
          size: compact ? 'icon-sm' : 'default',
        })}
        aria-label={contact ? `Edit ${contact.name}` : undefined}
        onClick={() => setOpen(true)}
      >
        {contact ? <PencilIcon /> : <PlusIcon />}
        {!compact && (contact ? 'Edit' : 'Add contact')}
      </button>
      <button
        type='button'
        aria-label='Close contact form'
        className={open ? 'fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]' : 'hidden'}
        onClick={close}
      />
      <section
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-hidden={!open}
        aria-label={contact ? `Edit ${contact.name}` : 'Add maintenance contact'}
        className={
          open
            ? 'fixed inset-y-0 right-0 z-50 flex w-full animate-in flex-col border-l border-border bg-card shadow-2xl duration-200 slide-in-from-right sm:max-w-xl'
            : 'hidden'
        }
      >
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label='Close contact form'
          className='absolute top-3 right-3 z-10'
          onClick={close}
        >
          <XIcon />
        </Button>
        <ContactFormBody
          key={`${formKey}-${open ? 'open' : (contact?.updated_at ?? 'new')}`}
          contact={contact}
          owners={owners}
          currentUserId={currentUserId}
          onClose={close}
        />
      </section>
    </>
  );
}

function QuickLinks({
  contact,
  compact = false,
}: {
  contact: MaintenanceContact;
  compact?: boolean;
}) {
  return (
    <div className='flex flex-wrap items-center gap-1'>
      {contact.phone && (
        <a
          href={`tel:${contact.phone}`}
          aria-label={`Call ${contact.name}`}
          className={buttonVariants({ variant: 'ghost', size: compact ? 'icon-sm' : 'sm' })}
        >
          <PhoneIcon />
          {!compact && contact.phone}
        </a>
      )}
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          aria-label={`Email ${contact.name}`}
          className={buttonVariants({ variant: 'ghost', size: compact ? 'icon-sm' : 'sm' })}
        >
          <MailIcon />
          {!compact && contact.email}
        </a>
      )}
    </div>
  );
}

function ContactStateActions({
  contact,
  currentUserId,
  compact = false,
}: {
  contact: MaintenanceContact;
  currentUserId: string;
  compact?: boolean;
}) {
  const archiveFormRef = useRef<HTMLFormElement>(null);
  const archived = Boolean(contact.archived_at);

  return (
    <div className='flex items-center justify-end gap-1'>
      {!archived && (
        <form action={setMaintenanceContactPreferred}>
          <input type='hidden' name='id' value={contact.id} />
          <input type='hidden' name='value' value={contact.is_preferred ? 'false' : 'true'} />
          <Button
            type='submit'
            variant='ghost'
            size={compact ? 'icon-sm' : 'sm'}
            aria-label={
              contact.is_preferred
                ? `Unmark ${contact.name} as preferred`
                : `Mark ${contact.name} as preferred`
            }
            className={contact.is_preferred ? 'text-warning hover:text-warning' : undefined}
          >
            <StarIcon className={contact.is_preferred ? 'fill-current' : undefined} />
            {!compact && (contact.is_preferred ? 'Preferred' : 'Prefer')}
          </Button>
        </form>
      )}

      <ContactFormSheet contact={contact} currentUserId={currentUserId} compact={compact} />

      <form ref={archiveFormRef} action={setMaintenanceContactArchived}>
        <input type='hidden' name='id' value={contact.id} />
        <input type='hidden' name='value' value={archived ? 'false' : 'true'} />
        {archived ? (
          <Button
            type='submit'
            variant='ghost'
            size={compact ? 'icon-sm' : 'sm'}
            aria-label={`Restore ${contact.name}`}
          >
            <ArchiveRestoreIcon />
            {!compact && 'Restore'}
          </Button>
        ) : (
          <ConfirmButton
            formRef={archiveFormRef}
            title='Archive contact'
            message={`Archive ${contact.name}? You can restore this contact later.`}
            confirmLabel='Archive'
            triggerSize={compact ? 'xs' : 'sm'}
            triggerClassName={compact ? 'size-7 px-0' : undefined}
          >
            <ArchiveIcon />
            {compact ? <span className='sr-only'>Archive {contact.name}</span> : 'Archive'}
          </ConfirmButton>
        )}
      </form>
    </div>
  );
}

function ServiceBadges({ services }: { services: MaintenanceContact['services'] }) {
  return (
    <div className='flex flex-wrap gap-1'>
      {services.map((service) => (
        <Badge key={service} variant='success'>
          {MAINTENANCE_SERVICE_LABELS[service]}
        </Badge>
      ))}
    </div>
  );
}

export function ContactDirectory({
  contacts,
  owners,
  currentUserId,
  activeCount,
  page,
  totalPages,
  filters,
}: {
  contacts: MaintenanceContact[];
  owners?: ContactOwnerOption[];
  currentUserId: string;
  activeCount: number;
  page: number;
  totalPages: number;
  filters: DirectoryFilters;
}) {
  const hasFilters = Boolean(
    filters.q ||
    filters.service ||
    filters.preferred ||
    filters.owner ||
    filters.status === 'archived',
  );

  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='font-heading text-2xl font-semibold tracking-tight'>
            Maintenance Contacts
          </h1>
          <p className='text-sm text-muted-foreground'>
            {activeCount} active {activeCount === 1 ? 'contact' : 'contacts'} ready when repairs are
            needed.
          </p>
        </div>
        <ContactFormSheet owners={owners} currentUserId={currentUserId} />
      </div>

      <Card className='p-4'>
        <form
          method='get'
          className='grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_150px_150px_auto]'
        >
          <Label className='relative block'>
            <span className='sr-only'>Search contacts</span>
            <SearchIcon className='pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground' />
            <Input
              name='q'
              defaultValue={filters.q}
              placeholder='Search contacts…'
              className='pl-8'
            />
          </Label>
          <NativeSelect name='service' defaultValue={filters.service ?? ''} aria-label='Service'>
            <option value=''>All services</option>
            {MAINTENANCE_SERVICES.map((service) => (
              <option key={service.value} value={service.value}>
                {service.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            name='preferred'
            defaultValue={filters.preferred ?? ''}
            aria-label='Preferred'
          >
            <option value=''>All contacts</option>
            <option value='true'>Preferred only</option>
          </NativeSelect>
          <NativeSelect name='status' defaultValue={filters.status ?? 'active'} aria-label='Status'>
            <option value='active'>Active</option>
            <option value='archived'>Archived</option>
          </NativeSelect>
          {owners && (
            <NativeSelect name='owner' defaultValue={filters.owner ?? ''} aria-label='Owner'>
              <option value=''>All owners</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </NativeSelect>
          )}
          <div className='flex gap-2 lg:col-span-full lg:justify-end'>
            {hasFilters && (
              <Button
                nativeButton={false}
                variant='outline'
                render={<Link href='/maintenance/contacts' />}
              >
                Clear
              </Button>
            )}
            <Button type='submit'>
              <SearchIcon />
              Apply filters
            </Button>
          </div>
        </form>
      </Card>

      {contacts.length === 0 ? (
        <Card className='grid min-h-64 place-items-center p-8 text-center'>
          <div className='max-w-sm'>
            <span className='mx-auto mb-4 grid size-11 place-items-center rounded-full bg-success-muted text-primary'>
              <WrenchIcon className='size-5' />
            </span>
            <h2 className='font-heading text-lg font-semibold'>
              {hasFilters ? 'No contacts match these filters' : 'No maintenance contacts yet'}
            </h2>
            <p className='mt-1 text-sm text-muted-foreground'>
              {hasFilters
                ? 'Try clearing or changing the search filters.'
                : 'Add trusted contractors so their details are ready when something needs repair.'}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Card className='hidden py-0 md:block'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Contact details</TableHead>
                    <TableHead>Coverage</TableHead>
                    {owners && <TableHead>Owner</TableHead>}
                    <TableHead>
                      <span className='sr-only'>Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className='flex items-start gap-2'>
                          {contact.is_preferred && (
                            <StarIcon
                              className='mt-0.5 size-4 fill-warning text-warning'
                              aria-label='Preferred'
                            />
                          )}
                          <div>
                            <div className='font-medium'>{contact.name}</div>
                            {contact.company && (
                              <div className='text-xs text-muted-foreground'>{contact.company}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className='max-w-64'>
                        <ServiceBadges services={contact.services} />
                      </TableCell>
                      <TableCell>
                        <QuickLinks contact={contact} />
                      </TableCell>
                      <TableCell className='max-w-48'>
                        <div>{contact.service_area || '—'}</div>
                        {contact.availability && (
                          <div className='text-xs text-muted-foreground'>
                            {contact.availability}
                          </div>
                        )}
                      </TableCell>
                      {owners && (
                        <TableCell className='text-muted-foreground'>
                          {contact.owner_name}
                        </TableCell>
                      )}
                      <TableCell>
                        <ContactStateActions
                          contact={contact}
                          currentUserId={currentUserId}
                          compact
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className='grid gap-3 md:hidden'>
            {contacts.map((contact) => (
              <Card key={contact.id} className='p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <h2 className='truncate font-heading font-semibold'>{contact.name}</h2>
                      {contact.is_preferred && (
                        <StarIcon
                          className='size-4 shrink-0 fill-warning text-warning'
                          aria-label='Preferred'
                        />
                      )}
                    </div>
                    {contact.company && (
                      <p className='truncate text-xs text-muted-foreground'>{contact.company}</p>
                    )}
                  </div>
                  <ContactStateActions contact={contact} currentUserId={currentUserId} compact />
                </div>
                <div className='mt-3'>
                  <ServiceBadges services={contact.services} />
                </div>
                {(contact.service_area || contact.availability) && (
                  <div className='mt-3 rounded-lg bg-muted px-3 py-2 text-xs'>
                    {contact.service_area && <p>{contact.service_area}</p>}
                    {contact.availability && (
                      <p className='text-muted-foreground'>{contact.availability}</p>
                    )}
                  </div>
                )}
                {owners && (
                  <p className='mt-3 text-xs text-muted-foreground'>Owner: {contact.owner_name}</p>
                )}
                <div className='mt-3 border-t border-border pt-2'>
                  <QuickLinks contact={contact} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <PaginationNav
        page={page}
        totalPages={totalPages}
        basePath='/maintenance/contacts'
        params={filters}
      />
    </div>
  );
}
