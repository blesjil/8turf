-- Login lockout state, keyed by attempted email (lowercased).
-- Rows for unknown emails are intentional: locking behaves identically for
-- existing and nonexistent accounts, so lockout responses leak nothing.
create table login_attempts (
  email text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Auth hot path: better-auth looks up the credential account on every sign-in
create index account_provider_account_idx on account ("providerId", "accountId");

-- better-auth queries verification rows by identifier
create index verification_identifier_idx on verification (identifier);

-- Matches the unit-page payments query:
-- WHERE tenant_id = $1 ORDER BY period_start DESC, period_end DESC, paid_date DESC
create index idx_rent_payments_tenant_period_start
  on rent_payments (tenant_id, period_start desc, period_end desc, paid_date desc);

-- Superseded by the composite index above
drop index idx_rent_payments_tenant_id;
