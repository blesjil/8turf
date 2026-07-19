-- Emergency rollback for migration 0011.
--
-- Keep this file outside supabase/migrations so it is never applied
-- automatically. This restores the pre-0011 RLS flags and privileges captured
-- from production on 2026-07-18.
--
-- Prefer the fast availability rollback (disabling RLS only) when the direct
-- Postgres application is affected. Restoring anon/authenticated privileges
-- reopens the Data API exposure that migration 0011 is intended to close.

begin;

alter table public."user" disable row level security;
alter table public.account disable row level security;
alter table public.session disable row level security;
alter table public.verification disable row level security;
alter table public.login_attempts disable row level security;

alter table public.properties disable row level security;
alter table public.units disable row level security;
alter table public.tenants disable row level security;
alter table public.tenant_documents disable row level security;
alter table public.rent_payments disable row level security;
alter table public.expenses disable row level security;
alter table public.payment_reminders disable row level security;

-- Exact-state privilege restoration. Run this section only if the application
-- or an integration is proven to depend on anon/authenticated Data API access.
grant all privileges on all tables in schema public
  to anon, authenticated;

grant all privileges on all sequences in schema public
  to anon, authenticated;

grant execute on all functions in schema public
  to public;

grant all privileges on all functions in schema public
  to anon, authenticated;

alter function public.set_updated_at() reset search_path;

alter default privileges for role postgres in schema public
  grant all privileges on tables to anon, authenticated;

alter default privileges for role postgres in schema public
  grant all privileges on sequences to anon, authenticated;

alter default privileges for role postgres in schema public
  grant execute on functions to public;

alter default privileges for role postgres in schema public
  grant all privileges on functions to anon, authenticated;

commit;
