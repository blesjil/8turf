-- Enable RLS on every application table exposed through the public schema.
--
-- 8turf authenticates with Better Auth and accesses Postgres directly from the
-- server. It does not use Supabase Auth or the Supabase Data API, so there are
-- intentionally no policies for anon/authenticated. With RLS enabled and no
-- applicable policy, those roles are denied by default.
--
-- Do not add FORCE ROW LEVEL SECURITY here. The production application is
-- expected to connect as the postgres table owner through the Supabase pooler,
-- and table owners bypass non-forced RLS.

begin;

alter table public."user" enable row level security;
alter table public.account enable row level security;
alter table public.session enable row level security;
alter table public.verification enable row level security;
alter table public.login_attempts enable row level security;

alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_documents enable row level security;
alter table public.rent_payments enable row level security;
alter table public.expenses enable row level security;
alter table public.payment_reminders enable row level security;

-- Remove current Data API access. Keep service_role access for Supabase
-- administration and recovery; service_role bypasses RLS and must remain secret.
revoke all privileges on all tables in schema public
  from anon, authenticated;

revoke all privileges on all sequences in schema public
  from anon, authenticated;

-- Function EXECUTE is granted to PUBLIC by PostgreSQL by default. RLS does not
-- protect functions, so remove both inherited PUBLIC access and direct grants.
revoke execute on all functions in schema public
  from public, anon, authenticated;

-- The security advisor flags mutable function search paths. This trigger
-- function only assigns NEW.updated_at and does not need schema lookup.
alter function public.set_updated_at() set search_path = '';

-- Ensure future objects created by postgres are not automatically exposed.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
