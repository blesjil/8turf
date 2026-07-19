# Production RLS rollout

This runbook covers `0011_enable_rls_and_lock_down_data_api.sql`. It is a
security-boundary rollout for the Supabase Data API. It does not add database
tenant isolation for Better Auth users.

## Safety rules

- Do not use `FORCE ROW LEVEL SECURITY`.
- Do not add `auth.uid()` policies. 8turf uses Better Auth, not Supabase Auth.
- Do not apply the production migration until every preflight gate passes.
- Keep the rollback file outside `supabase/migrations`.
- Never print or commit `DATABASE_URL` or database passwords.

## Gate 1: production preflight

From the same database connection used by the deployed application, capture:

```sql
select
  current_user,
  current_database(),
  r.rolsuper,
  r.rolbypassrls
from pg_roles r
where r.rolname = current_user;
```

Expected application role: `postgres`. The forward migration is blocked if the
deployed role is neither the table owner nor a role with `BYPASSRLS`.

Capture current RLS state:

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname = 'public'
order by c.relname;
```

Capture current policies:

```sql
select *
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Confirm all of the following:

- The application role is verified.
- No application code or integration uses Supabase REST or GraphQL.
- A current schema-only dump is stored securely and its checksum recorded.
- A restorable Supabase backup or manual logical backup is verified.
- Baseline production login, dashboard, report, and CRUD smoke tests pass.

## Gate 2: staging rehearsal

1. Restore a recent production-like schema and representative sanitized data.
2. Apply migrations through `0011`.
3. Run the full automated test suite.
4. Run these application smoke tests:
   - sign in, session refresh, and sign out;
   - dashboard, payments, and financial report reads;
   - property, unit, tenant, payment, and expense create/update/delete paths;
   - admin user operations;
   - tenant document upload and download;
   - reminder workflows.
5. Verify every public table has RLS enabled and not forced.
6. Verify there are no policies for `anon` or `authenticated`.
7. Run the Supabase security advisor and confirm the RLS, sensitive-column, and
   mutable-function-search-path findings are cleared.
8. Verify Data API roles are denied:

   ```sql
   begin;
   set local role anon;
   select * from public.properties limit 1;
   rollback;
   ```

   The query must fail with `permission denied`.

9. Apply the rollback script and repeat the application smoke tests.
10. Reapply `0011` and repeat the critical smoke tests.

Production is blocked unless the forward, rollback, and reapply rehearsals pass.

## Production rollout

1. Choose a low-traffic window and pause unrelated database deployments.
2. Confirm the backup, schema dump, checksum, rollback script, and operator.
3. Record baseline application error and latency metrics.
4. Apply only the forward migration.
5. Immediately test login, dashboard/report reads, and a reversible write.
6. Monitor application and database logs for at least 30 minutes.

Rollback triggers:

- authentication or session failures;
- `permission denied` or row-security database errors from the application;
- unexpectedly empty dashboards or reports;
- failed application inserts, updates, or deletes;
- a sustained increase in HTTP 5xx errors.

## Rollback

For the fastest application recovery, run only the `DISABLE ROW LEVEL SECURITY`
statements from:

`supabase/rollbacks/0011_enable_rls_and_lock_down_data_api.sql`

Do not restore `anon` or `authenticated` privileges unless an integration is
proven to depend on the Data API. If exact-state restoration is required, run
the complete rollback file and treat the reopened Data API exposure as an
incident requiring follow-up.

After rollback, repeat login, dashboard/report, and reversible-write smoke
tests, then retain the production schema snapshot and logs for diagnosis.

## Post-rollout

After a stable observation period:

- disable the unused Supabase Data API as a separate change;
- set `auto_expose_new_tables = false` where applicable;
- document the production application database role;
- rerun the RLS/grant audit after every schema migration.
