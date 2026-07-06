-- 0001_init.sql
-- Full schema for 8turf Apartments: better-auth tables + rental domain tables.
-- Translated from the previous bun:sqlite schema (lib/db.ts).
--
-- Conventions:
--   * ids are text (better-auth generates text ids; existing data migrated from SQLite uses text ids)
--   * money is integer cents, never float
--   * date-like business fields stay text ISO strings (YYYY-MM-DD / YYYY-MM), matching app code
--   * no ON DELETE CASCADE anywhere — payment history must never be silently destroyed

-- ---------------------------------------------------------------------------
-- better-auth core tables ("user" is a reserved word in Postgres — always quote it)
-- ---------------------------------------------------------------------------

create table "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  role text default 'user',
  banned boolean,
  "banReason" text,
  "banExpires" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table session (
  id text primary key,
  "userId" text not null references "user" (id),
  token text not null unique,
  "expiresAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "impersonatedBy" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index session_user_id_idx on session ("userId");

create table account (
  id text primary key,
  "userId" text not null references "user" (id),
  "accountId" text not null,
  "providerId" text not null,
  "accessToken" text,
  "refreshToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  "idToken" text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index account_user_id_idx on account ("userId");

create table verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger shared by all domain tables
-- ---------------------------------------------------------------------------

create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------

create table properties (
  id text primary key,
  user_id text not null references "user" (id),
  name text not null,
  address text not null,
  archived_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_properties_user_id on properties (user_id);

create trigger update_properties_timestamp
  before update on properties
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------

create table units (
  id text primary key,
  property_id text not null references properties (id),
  unit_label text not null,
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms real not null default 1 check (bathrooms >= 0),
  rent_amount integer not null check (rent_amount >= 0),
  archived_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_units_property_id on units (property_id);

create trigger update_units_timestamp
  before update on units
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------

create table tenants (
  id text primary key,
  unit_id text not null references units (id),
  name text not null,
  email text,
  phone text,
  rent_amount integer not null check (rent_amount >= 0),
  lease_start_date text not null,
  lease_end_date text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tenants_unit_id on tenants (unit_id);

-- Enforce at most one active tenant per unit
create unique index idx_tenants_active_unit on tenants (unit_id) where is_active;

create trigger update_tenants_timestamp
  before update on tenants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- rent_payments
-- ---------------------------------------------------------------------------

create table rent_payments (
  id text primary key,
  tenant_id text not null references tenants (id),
  unit_id text not null references units (id),
  amount integer not null check (amount > 0),
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  paid_date text not null,
  method text,
  notes text,
  payment_type text not null default 'rental'
    check (payment_type in ('deposit', 'advance', 'reservation', 'rental')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rent_payments_tenant_id on rent_payments (tenant_id);
create index idx_rent_payments_unit_id on rent_payments (unit_id);
create index idx_rent_payments_tenant_period on rent_payments (tenant_id, period);
create index idx_rent_payments_period on rent_payments (period);

create trigger update_rent_payments_timestamp
  before update on rent_payments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------

create table expenses (
  id text primary key,
  property_id text not null references properties (id),
  unit_id text references units (id),
  category text not null check (category in ('repair', 'cleaning', 'tax', 'other', 'repaint')),
  amount integer not null check (amount > 0),
  expense_date text not null,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expenses_property_id on expenses (property_id);
create index idx_expenses_unit_id on expenses (unit_id);

create trigger update_expenses_timestamp
  before update on expenses
  for each row execute function set_updated_at();
