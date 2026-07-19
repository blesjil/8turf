# RLS production preflight — 2026-07-18

Project: `8turf` (`fcuietwzxptglcgtsgqt`, South Asia/Mumbai)

Production migration `0011` was applied successfully on 2026-07-18.

## Confirmed

- A fresh schema-only production dump was captured with:
  `supabase db dump --linked --schema public`.
- Snapshot SHA-256:
  `fc39b0b6b6f57fa48157efdb11f9f65620fb67e39048419530180a69296655c4`.
- All 12 application tables are owned by `postgres`.
- The live `postgres` role has `BYPASSRLS`; it is not a superuser.
- No custom application login role exists. The code uses direct `pg` access and
  the documented production pooler user is `postgres.<project-ref>`.
- RLS is disabled on all 12 application tables.
- No RLS policies exist in `public`.
- `anon` and `authenticated` have broad table grants.
- Supabase's security advisor reports 12 `rls_disabled_in_public` errors,
  including exposed password-hash and session-token columns.
- The advisor reports `public.set_updated_at()` has a mutable search path; the
  forward migration hardens it and the rollback restores its prior setting.
- The repository contains no Supabase client, REST, or GraphQL database access.
- The application uses a server-side `pg` pool with `DATABASE_URL`.
- The repository documents the production pooler username as
  `postgres.<project-ref>`.
- Production migration history exactly matches local migrations `0001` through
  `0010`; migration `0011` has not been applied.

## Not yet confirmed

- A production-like staging environment with representative sanitized data has
  not yet been identified.

## Recovery artifact

- Supabase reports WAL-G enabled and PITR disabled, with no accessible automatic
  backup timestamps.
- A manual production logical data export was created at
  `/private/tmp/8turf-pre-rls-data-2026-07-18.sql`.
- The file mode is `0600` and its size is 30,338 bytes.
- SHA-256:
  `8c71efbe7121d0425857ce983afd70b6248908de3e366403e0dacc4cb2a5f087`.
- Every public-table COPY row count in the backup exactly matches the live
  production count.
- The file contains production records, password hashes, and session data. It
  must not be committed, shared, or retained longer than the rollback window.

## Local verification evidence

`bun run test:rls` completed successfully against an isolated temporary
database in the local Supabase stack:

- all 11 migrations applied;
- all 12 expected tables had RLS enabled and not forced;
- `anon` access was denied;
- direct access as the `postgres` owner continued to work;
- owner-role inserts, joins, updates, and deletes passed across authentication,
  property, unit, tenant, payment, expense, reminder, and document tables;
- the rollback restored the pre-migration RLS state;
- the forward migration reapplied successfully.
- migration `0011` applied successfully to the existing local Supabase database;
- the application `lib/db.ts` pool queried successfully as `postgres` after RLS
  was enabled;
- the post-migration local security advisor reported no errors or warnings,
  only the expected informational `rls_enabled_no_policy` notices.

Additional checks:

- `bun run test:run`: 88 tests passed.
- `bun run build`: production build passed.
- ESLint and `git diff --check`: passed.

## Production gate

The production gate passed:

1. the application database role and RLS bypass behavior were confirmed;
2. an approved logical backup was created and validated;
3. local forward, rollback, reapply, CRUD, build, and test checks passed.

## Production result

- Migration history records `0011_enable_rls_and_lock_down_data_api`.
- All 12 public application tables have RLS enabled.
- `FORCE ROW LEVEL SECURITY` remains disabled on every table.
- `anon` and `authenticated` no longer have table access.
- Owner reads as `postgres` succeed after the migration.
- The production Supabase security advisor reports no warnings or errors.
- Public authentication/session endpoints respond normally.
- The user completed an authenticated login and page-navigation smoke test.
- Vercel reported no production errors during the rollout window.
- No rollback trigger fired.
