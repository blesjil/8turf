-- Log of unpaid-dues reminder emails sent from the Payments Overview, so the
-- UI can show when a tenant was last reminded for a month and confirm before
-- re-sending.
create table payment_reminders (
  id text primary key,
  tenant_id text not null references tenants (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  sent_to text not null,
  amount_due integer not null check (amount_due > 0),
  sent_at timestamptz not null default now()
);

create index idx_payment_reminders_tenant_period on payment_reminders (tenant_id, period);
