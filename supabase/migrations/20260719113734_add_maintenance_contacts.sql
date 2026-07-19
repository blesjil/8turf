begin;

create table public.maintenance_contacts (
  id text primary key,
  user_id text not null references public."user" (id),
  name text not null check (length(btrim(name)) > 0),
  company text,
  phone text,
  email text,
  service_area text,
  availability text,
  notes text,
  services text[] not null
    check (
      cardinality(services) > 0
      and services <@ array[
        'plumber',
        'electrician',
        'carpenter',
        'engineer',
        'handyman_repair',
        'aircon_hvac',
        'appliance_repair',
        'locksmith',
        'cleaning',
        'pest_control',
        'roofing',
        'landscaping',
        'other'
      ]::text[]
    ),
  is_preferred boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_contacts_contact_method_check
    check (
      nullif(btrim(phone), '') is not null
      or nullif(btrim(email), '') is not null
    )
);

create index idx_maintenance_contacts_owner_status
  on public.maintenance_contacts (user_id, archived_at);

create index idx_maintenance_contacts_active_owner_name
  on public.maintenance_contacts (user_id, is_preferred desc, name)
  where archived_at is null;

create index idx_maintenance_contacts_services
  on public.maintenance_contacts using gin (services);

create trigger update_maintenance_contacts_timestamp
  before update on public.maintenance_contacts
  for each row execute function public.set_updated_at();

alter table public.maintenance_contacts enable row level security;

-- 8turf uses Better Auth plus server-side SQL. The Data API must not expose
-- these owner-scoped records.
revoke all privileges on table public.maintenance_contacts
  from anon, authenticated;

commit;
