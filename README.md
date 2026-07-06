# 8turf

A rental property management web app for landlords. Track properties, units, tenants, and a full rent payment ledger — with derived paid / partial / unpaid status per calendar month across your whole portfolio.

The app is admin-only: there is no tenant-facing portal or public area. Accounts are created by an admin (public sign-up is disabled).

## Features

- **Properties & units** — CRUD with archive-instead-of-delete so history is never lost
- **Tenants** — assign one active tenant per unit, track lease dates, rent owed, and full tenancy history
- **Payment ledger** — record individual payments (amount, period, date, method, notes) per tenant, with edit/delete for corrections
- **Monthly status** — paid / partial / unpaid derived from the ledger, never stored
- **Cross-property payments view** — pick a month and see every unit's status at a glance
- **Expenses & financial report** — per-property/unit expenses with a monthly financial overview
- **Admin user management** — admins create accounts, reset passwords, and promote users at `/admin/users`

## Tech Stack

| Layer                     | Choice                                                                           |
| ------------------------- | -------------------------------------------------------------------------------- |
| Framework                 | Next.js 16 (App Router), React 19, TypeScript strict                             |
| Runtime / package manager | Bun                                                                              |
| Styling                   | Tailwind CSS 4 + shadcn/ui                                                       |
| Auth                      | better-auth (email/password + admin plugin, sign-up disabled)                    |
| Database                  | Supabase Postgres (local via Supabase CLI + Docker), raw SQL through a `pg` Pool |
| Validation                | Zod                                                                              |
| Testing                   | Vitest                                                                           |

All mutations are Next.js Server Actions colocated in per-route `actions.ts` files — there are no JSON API routes. See [SPEC.MD](SPEC.MD) for the full technical specification, database schema, and authorization model.

## Getting Started

Prerequisites: [Bun](https://bun.sh), [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running), and the [Supabase CLI](https://supabase.com/docs/guides/cli).

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Start the local database** (project `8turf`; Postgres on port 54342, Studio on 54343)

   ```bash
   supabase start
   ```

   This also applies the schema from `supabase/migrations/`.

3. **Configure environment** — create `.env.local`:

   ```bash
   BETTER_AUTH_SECRET=<any-long-random-string>
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54342/postgres
   ```

4. **Bootstrap the first admin account** (sign-up is disabled, so a fresh database needs one)

   ```bash
   bun run scripts/create-admin.ts <email> <name>
   ```

5. **Run the dev server**

   ```bash
   bun dev
   ```

   Open http://localhost:3000 and sign in.

## Commands

```bash
bun dev          # Start development server
bun run build    # Build for production
bun start        # Start production server
bun run lint     # Run ESLint
bun test         # Run Vitest unit tests
supabase db reset # Recreate the local database from migrations
```

## Project Structure

```
app/                  # App Router pages; mutations in per-route actions.ts
  admin/users/        # Admin-only user management
  dashboard/          # Property list (authenticated home)
  properties/         # Property → unit → tenant/payment pages
  payments/           # Cross-property monthly status view
  financial-report/   # Income vs expenses overview
components/           # Shared UI (shadcn/ui primitives in components/ui/)
lib/                  # db.ts (pg Pool), auth.ts, validation.ts, payment-status.ts
supabase/migrations/  # Database schema, applied by the Supabase CLI
scripts/              # create-admin.ts and one-off maintenance scripts
__tests__/            # Vitest unit tests
```

## Conventions

- **Money** is stored as integer cents; converted to display format only at the UI boundary.
- **Dates** are ISO strings: `YYYY-MM-DD` for dates, `YYYY-MM` for payment periods.
- **Authorization**: only `properties` has a `user_id`; every query on units/tenants/payments joins up the ownership chain to the session user (see §11 of the spec).
- **No cascading deletes**: parents with history can only be archived, never hard-deleted.
