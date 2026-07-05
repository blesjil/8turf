# Technical Specification – Rental Management Web App

## 1. Overview

A web application where an authenticated landlord manages multiple rental properties: the units within each property, the tenant currently occupying each unit, the rent they owe, and a full ledger of rent payments used to derive a paid/partial/unpaid status per calendar month.

This is a full pivot from the app's original note-taking purpose. There is no tenant-facing login, portal, or public sharing — the application is admin-only, used by the landlord (or property manager) account.

### Core Features

- User authentication (sign up, login, logout) via better-auth (unchanged from prior version)
- Property management (CRUD), scoped per landlord account
- Unit management per property (CRUD)
- Tenant tracking per unit: current occupant, rent owed, lease dates, tenancy history
- Rent payment ledger: individual payment entries (amount, date, method, notes) per tenant
- Derived monthly payment status (paid / partial / unpaid) per unit, computed from the ledger
- Cross-property monthly payment status view (pick a month, see every unit's status at a glance)
- Archiving for properties/units with history (instead of destructive delete)

### Tech

- Next.js (App Router) + Bun runtime
- TypeScript
- TailwindCSS
- SQLite via Bun's SQLite client (`bun:sqlite`) with raw SQL

## 2. Architecture

### 2.1 High-Level Architecture

- **Frontend & Backend:** Next.js (App Router)
  - Server components for data fetching
  - Client components only where interactivity is required (forms, month picker, tenancy/payment dialogs)
  - Next.js Server Actions (`'use server'` functions in per-route `actions.ts` files) for all mutations — this app has no dedicated `/api/*` JSON routes for its domain data (matches the pattern already established for notes)
- **Runtime:** Bun (for dev & production)
- **Database:** Single SQLite file (`data/app.db`) accessed via Bun's SQLite client
- **Auth:** better-auth integrated into Next.js (middleware + server helpers) — unchanged

### 2.2 Application Layers

**Presentation layer**
- Next.js pages and components
- TailwindCSS for styling

**Server action layer**
- Mutations live as `'use server'` functions colocated with their route (`app/properties/[id]/actions.ts`, etc.)
- No repository/DAO layer — raw SQL is written directly in server actions and server components, consistent with the app's existing convention

**Data access layer**
- Raw SQL queries executed via Bun's SQLite client
- `lib/db.ts` owns schema creation and the singleton connection
- `lib/payment-status.ts` holds pure functions for deriving payment status and lease coverage, used by both the unit detail page and the cross-property `/payments` view

## 3. Functional Requirements

### 3.1 Authentication

Login stays self-service; account creation does not:
- Log in / log out via better-auth's email/password flow (`signIn.email`, `signOut`) — unchanged
- **Public self-registration is disabled** (`emailAndPassword.disableSignUp: true`). There is no sign-up form; new accounts can only be created by an admin
- Auth state accessible on server (SSR) and client
- All routes except `/`, `/authenticate` require a session; unauthenticated users are redirected to `/authenticate`

**Admin-managed accounts** (via better-auth's `admin` plugin):
- Every user has a `role` (`user` or `admin`), stored on the `user` table
- An admin creates new accounts from `/admin/users` by entering an email + name; the system generates a random temporary password, shown once to the admin to relay to the new user manually (no email-sending integration exists or is required)
- An admin can promote any existing user to `admin` from the same page
- The very first admin account is created outside the web UI, via a one-time seed script: `bun run scripts/create-admin.ts <email> <name>` — run once during setup
- `/admin/users` is admin-only: unauthenticated visitors are redirected to `/authenticate`; authenticated non-admins get a 404 (the existence of the admin surface isn't revealed to regular users)

There is no unauthenticated/public area for rental data — the previous public note-sharing concept is removed entirely.

### 3.2 Properties (Authenticated)

- **Create:** name + address
- **List:** all non-archived properties owned by the current user, with unit count
- **View:** property detail — list of its units (non-archived), add-unit entry point
- **Update:** name/address
- **Archive:** hide from default views without deleting data
- **Delete:** hard delete only permitted when the property has zero units; otherwise the action returns a friendly error directing the user to archive instead

### 3.3 Units (Authenticated)

- **Create** (within a property): unit label (e.g. "Unit 2B"), bedrooms, bathrooms, asking rent amount
- **View:** unit detail — current tenant (if any), full tenancy history, full payment ledger, derived monthly status
- **Update:** label, bedrooms, bathrooms, asking rent
- **Archive:** hide from default views (e.g. unit taken offline) without deleting data
- **Delete:** hard delete only permitted when the unit has never had a tenant assigned; otherwise return a friendly error directing the user to archive instead

### 3.4 Tenants (Authenticated)

- **Assign tenant to unit:** name, email (optional), phone (optional), rent amount owed, lease start date, lease end date (optional — open-ended lease)
  - A unit may have **at most one active tenant at a time**, enforced at the database level
  - The unit's asking rent pre-fills the tenant's rent amount but the tenant's own rent amount is the source of truth for payment math (may differ from the unit's asking rent)
- **Update tenant:** correct name/contact/rent/lease dates while still active
- **End tenancy:** sets the tenant inactive and records a lease end date, freeing the unit for a new tenant assignment. The outgoing tenant's record and full payment history are preserved permanently — a tenant row is never moved to a different unit
- **View tenancy history:** unit detail page lists every tenant who has ever occupied it, past and present

### 3.5 Rent Payment Ledger (Authenticated)

- **Record a payment:** amount, the calendar month (period, `YYYY-MM`) it applies toward, the date paid, an optional method (cash / bank transfer / check / other), optional notes
  - Multiple payments can apply to the same period (e.g. a tenant pays in two installments)
  - Payments can be recorded against any tenant ever tied to a unit, not only the currently active one, so historical corrections remain possible after move-out
- **Edit / delete a payment:** for correcting data-entry mistakes
- **Derived monthly status** (not stored, computed on read): for a given tenant + period, sum all payment amounts for that period and compare to the tenant's rent amount:
  - `unpaid` — sum is 0
  - `partial` — `0 < sum < rent_amount`
  - `paid` — `sum >= rent_amount`
- A period only counts as "owed" if it falls within the tenant's lease coverage (`lease_start_date` ≤ period ≤ `lease_end_date` or lease is still open). **This check always uses lease dates, never `is_active`** — a tenant who has since moved out must still show correct historical status for the months they occupied the unit.

### 3.6 Cross-Property Monthly Payment View (Authenticated)

- `/payments`: pick a month (defaults to current month); see every property/unit/tenant with rent amount, amount paid, and derived status (paid/partial/unpaid) for that month, across all of the user's properties
- Each row links through to the relevant unit detail page

## 4. Non-Functional Requirements

**Performance**
- Property/unit/payment list and detail views should load under ~300 ms for typical data sizes

**Security**
- Every property, unit, tenant, and payment operation is scoped to the authenticated user's properties — see §11
- No public/anonymous routes exist for rental data

**Reliability**
- No destructive cascading deletes; payment history can never be silently lost through a parent delete

**Maintainability**
- Type-safe server actions and DB types
- Pure, unit-tested derivation logic (`lib/payment-status.ts`) shared between the unit detail page and the `/payments` view

**UX**
- Simple, minimal UI; clear empty states ("no properties yet", "no tenant assigned"); clear error messaging when a delete is blocked by existing history

## 5. Data Model & Database Schema (SQLite)

### 5.1 Tables

#### better-auth Core Tables

Unchanged from the prior version — `user`, `session`, `account`, `verification`. See existing `lib/db.ts` for their definitions; they are not modified by this pivot.

#### properties

```sql
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES user(id)
);
```

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT | Unique identifier (primary key) |
| user_id | TEXT | Owning landlord (foreign key to `user`) |
| name | TEXT | Property name |
| address | TEXT | Property address |
| archived_at | TEXT | Timestamp when archived, or NULL if active |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

#### units

```sql
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  bedrooms INTEGER NOT NULL DEFAULT 0 CHECK (bedrooms >= 0),
  bathrooms REAL NOT NULL DEFAULT 1 CHECK (bathrooms >= 0),
  rent_amount INTEGER NOT NULL CHECK (rent_amount >= 0),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);
```

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT | Unique identifier (primary key) |
| property_id | TEXT | Owning property (foreign key to `properties`) |
| unit_label | TEXT | e.g. "Unit 2B", "Room 1" |
| bedrooms | INTEGER | Number of bedrooms |
| bathrooms | REAL | Number of bathrooms (supports e.g. 1.5) |
| rent_amount | INTEGER | Asking rent in cents; default/prefill for new tenants, not the source of truth once a tenant is assigned |
| archived_at | TEXT | Timestamp when archived, or NULL if active |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

#### tenants

```sql
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  rent_amount INTEGER NOT NULL CHECK (rent_amount >= 0),
  lease_start_date TEXT NOT NULL,
  lease_end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- Enforce at most one active tenant per unit
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_active_unit ON tenants(unit_id) WHERE is_active = 1;
```

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT | Unique identifier (primary key) |
| unit_id | TEXT | Occupied unit (foreign key to `units`) — permanent, never reassigned |
| name | TEXT | Tenant name |
| email | TEXT | Tenant email (optional) |
| phone | TEXT | Tenant phone (optional) |
| rent_amount | INTEGER | Rent owed in cents — source of truth for payment status math |
| lease_start_date | TEXT | Lease start date (`YYYY-MM-DD`) |
| lease_end_date | TEXT | Lease end date, or NULL if ongoing |
| is_active | INTEGER | 1 if currently occupying the unit, 0 if moved out |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

**Moving a tenant:** there is no "move tenant to another unit" action. Moving means `endTenancy` on the current unit (sets `is_active = 0`, `lease_end_date`) followed by a brand new tenant row on the destination unit via `assignTenant`.

#### rent_payments

```sql
CREATE TABLE IF NOT EXISTS rent_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  period TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  paid_date TEXT NOT NULL,
  method TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);
```

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT | Unique identifier (primary key) |
| tenant_id | TEXT | Paying tenant (foreign key to `tenants`) — the authorization boundary |
| unit_id | TEXT | Denormalized for query convenience; always derived server-side from `tenant_id`, never trusted from client input |
| amount | INTEGER | Payment amount in cents, must be > 0 |
| period | TEXT | Calendar month this payment applies toward, `YYYY-MM` |
| paid_date | TEXT | Date the payment was made (`YYYY-MM-DD`) |
| method | TEXT | Optional: cash / bank_transfer / check / other |
| notes | TEXT | Optional free-text notes |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

No table in this schema uses `ON DELETE CASCADE`. All foreign keys are implicit `RESTRICT` — deleting a row with existing children is a constraint violation. This is intentional: payment history must never be silently destroyed by deleting an ancestor. See §3.2–3.3 for the archive-instead-of-delete policy this implies, and §11 for the authorization implication of `rent_payments.unit_id` being denormalized.

### 5.2 Indexes & Triggers

```sql
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_unit_id ON tenants(unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_active_unit ON tenants(unit_id) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_rent_payments_tenant_id ON rent_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_unit_id ON rent_payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_tenant_period ON rent_payments(tenant_id, period);
CREATE INDEX IF NOT EXISTS idx_rent_payments_period ON rent_payments(period);

-- Auto-update updated_at, same pattern as the prior update_notes_timestamp trigger
CREATE TRIGGER IF NOT EXISTS update_properties_timestamp AFTER UPDATE ON properties
BEGIN UPDATE properties SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_units_timestamp AFTER UPDATE ON units
BEGIN UPDATE units SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_tenants_timestamp AFTER UPDATE ON tenants
BEGIN UPDATE tenants SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_rent_payments_timestamp AFTER UPDATE ON rent_payments
BEGIN UPDATE rent_payments SET updated_at = datetime('now') WHERE id = NEW.id; END;
```

## 6. Backend: DB & Server Action Layer

### 6.1 Database Access Module

**File:** `lib/db.ts`

- Bun `bun:sqlite` `Database` singleton, path from `DB_PATH` env var (default `data/app.db`)
- WAL journal mode + `foreign_keys = ON` pragma
- Schema defined inline via `CREATE TABLE IF NOT EXISTS` at module load — no separate migration files, consistent with the prior version
- The old `notes` table, its indexes, and its trigger are removed; the four tables in §5.1 (plus their indexes/triggers) are added

### 6.2 Payment Status Helpers

**File:** `lib/payment-status.ts`

Pure functions, unit-tested, shared by the unit detail page and the `/payments` cross-property view:

- `computePaymentStatus(totalPaid: number, rentAmount: number): 'unpaid' | 'partial' | 'paid'`
- `isLeaseActiveForPeriod(leaseStartDate: string, leaseEndDate: string | null, period: string): boolean`

### 6.3 Validation

**File:** `lib/validation.ts`

Zod schemas replace the prior note schemas:
- `createPropertySchema`, `updatePropertySchema`
- `createUnitSchema`, `updateUnitSchema`
- `assignTenantSchema`, `updateTenantSchema`, `endTenancySchema`
- `recordPaymentSchema`, `updatePaymentSchema`

There is no repository/DAO layer — raw SQL queries live directly inside each route's `actions.ts` and in server component data fetching, always scoped by the authorization joins described in §11. This matches the pattern already established by the prior notes feature (see `app/notes/[id]/actions.ts` for the session-check → Zod `safeParse` → typed result object pattern to replicate).

## 7. Server Actions Design

All mutations are Next.js Server Actions (`'use server'`), colocated in each route's `actions.ts`. Every action begins with `auth.api.getSession({ headers: await headers() })` and returns/redirects appropriately if no session exists. Results follow the existing typed-result convention (e.g. `{ error: { field: string[], general?: string } }` from `zod.safeParse().error.flatten().fieldErrors`, or a success payload).

| Action | Route | Behavior |
|---|---|---|
| `createProperty` | `/properties/new` | Insert property for `session.user.id` |
| `updateProperty` | `/properties/[id]/edit` | Update name/address, authorized by `user_id` |
| `archiveProperty` | `/properties/[id]` | Set `archived_at`, authorized by `user_id` |
| `deleteProperty` | `/properties/[id]` | Hard delete only if zero units exist; otherwise return friendly error |
| `createUnit` | `/properties/[id]/units/new` | Insert unit under a property owned by the user |
| `updateUnit` | `/properties/[id]/units/[unitId]/edit` | Update unit fields, authorized via `property_id → properties.user_id` join |
| `archiveUnit` | unit detail | Set `archived_at`, same join-based authorization |
| `deleteUnit` | unit detail | Hard delete only if no tenant was ever assigned; otherwise friendly error |
| `assignTenant` | unit detail | Insert tenant row; rejects if the unit already has an active tenant (unique index conflict → friendly error) |
| `updateTenant` | unit detail | Update an active tenant's details |
| `endTenancy` | unit detail | Set `is_active = 0` and `lease_end_date` |
| `recordPayment` | unit detail | Insert a `rent_payments` row; `unit_id` derived server-side from the authorized `tenant_id`, never accepted from client input |
| `updatePayment` | unit detail | Correct an existing payment entry |
| `deletePayment` | unit detail | Remove a payment entry |

## 8. Frontend – Pages & Components

### 8.1 Routes

- `/` – Landing page (marketing copy for rental management, "Log in / Sign up" CTA)
- `/authenticate` – Login/signup (unchanged)
- `/dashboard` – Authenticated home: list of the user's non-archived properties with unit counts; "Create property" entry point
- `/properties/new` – Create property form
- `/properties/[id]` – Property detail: list of non-archived units, "Add unit" entry point, archive/delete controls
- `/properties/[id]/edit` – Edit property form
- `/properties/[id]/units/new` – Create unit form
- `/properties/[id]/units/[unitId]` – Unit detail: current tenant card (if any), full tenancy history, full payment ledger with record/edit/delete, archive/delete controls
- `/properties/[id]/units/[unitId]/edit` – Edit unit form
- `/payments` – Month picker + cross-property table of property/unit/tenant/rent/paid/status

Removed entirely: `/notes/*`, `/p/[slug]`.

### 8.2 Layout & Navigation

- Global layout: `app/layout.tsx` — header with app name (rebranded), login/logout
- `app/authenticate` retains its existing login/signup form pattern

### 8.3 Components

- **components/property-list.tsx** — renders the dashboard's property list
- **components/unit-list.tsx** — renders a property's units
- **components/tenant-card.tsx** — current tenant summary + end-tenancy action
- **components/payment-ledger.tsx** — table of payment entries with edit/delete, plus a record-payment form
- **components/payment-status-badge.tsx** — small paid/partial/unpaid indicator, driven by `lib/payment-status.ts`
- **components/month-picker.tsx** — month selector for the `/payments` view

Removed entirely: `rich-text-editor.tsx`, `share-toggle.tsx`, `tiptap-renderer.tsx`.

## 9. Money & Date Conventions

- All monetary amounts (`rent_amount`, `amount`) are stored as **integer cents**, never floating point, to avoid rounding errors. Convert to/from a display currency format only at the UI boundary.
- Dates are stored as ISO strings: full dates as `YYYY-MM-DD` (`lease_start_date`, `lease_end_date`, `paid_date`), and calendar months as `YYYY-MM` (`period`).

## 10. Styling (TailwindCSS)

- Minimal design: neutral background, card-style property/unit/tenant panels
- Status badges (paid/partial/unpaid) use distinct, accessible colors
- Utility classes on components; no changes to the existing Tailwind 4 + PostCSS setup

## 11. Security Considerations

**Auth enforcement**
- All routes except `/` and `/authenticate` check the session on the server; no session → redirect to `/authenticate`
- No public/anonymous routes remain for rental data (unlike the prior `/p/[slug]` public notes)

**Authorization — the key architectural risk in this design**

Only `properties` carries a direct `user_id` column. `units`, `tenants`, and `rent_payments` do **not** — every read/write on them must join up the ownership chain to confirm the row belongs to a property owned by `session.user.id`:

```sql
-- units
... WHERE id = ? AND property_id IN (SELECT id FROM properties WHERE user_id = ?)

-- tenants (unit -> property)
SELECT t.* FROM tenants t
JOIN units u ON u.id = t.unit_id
JOIN properties p ON p.id = u.property_id
WHERE t.id = ? AND p.user_id = ?

-- rent_payments (tenant -> unit -> property)
SELECT rp.* FROM rent_payments rp
JOIN tenants t ON t.id = rp.tenant_id
JOIN units u ON u.id = t.unit_id
JOIN properties p ON p.id = u.property_id
WHERE rp.id = ? AND p.user_id = ?
```

Skipping this join anywhere is the primary risk of one landlord seeing or modifying another landlord's data. `rent_payments.unit_id` is denormalized purely for query convenience and must never be treated as an authorization boundary or accepted as client input — always derive it server-side from the already-authorized `tenant_id`.

**Data integrity**
- No `ON DELETE CASCADE` anywhere — deleting a property/unit with existing children is rejected at the database level; the UI must offer archiving instead

## 12. Development Workflow

1. **(Done)** Admin-managed accounts: add better-auth's `admin` plugin, set `emailAndPassword.disableSignUp: true`, add the `role`/`banned`/`banReason`/`banExpires`/`impersonatedBy` columns to `lib/db.ts` via idempotent `ALTER TABLE`, build `/admin/users` (list + create-user + promote-to-admin), strip the sign-up path from `/authenticate`, and add the `scripts/create-admin.ts` bootstrap script.
2. Rewrite `lib/db.ts`: drop the `notes` table/index/trigger, add the four tables/indexes/triggers from §5. Delete TipTap/sharing-only files (`app/notes/`, `app/p/`, `components/rich-text-editor.tsx`, `components/share-toggle.tsx`, `components/tiptap-renderer.tsx`, `lib/sanitize.ts`, `lib/content.ts`, their tests) and unused dependencies (`@tiptap/*`, `isomorphic-dompurify`, `nanoid`) from `package.json`.
3. Rewrite `lib/validation.ts` with the new Zod schemas (in addition to the existing `createUserSchema`/`promoteToAdminSchema`); add `lib/payment-status.ts` with unit tests.
4. Build property CRUD: `/dashboard`, `/properties/new`, `/properties/[id]`, `/properties/[id]/edit` + `createProperty`/`updateProperty`/`archiveProperty`/`deleteProperty`.
5. Build unit CRUD: `/properties/[id]/units/new`, `/properties/[id]/units/[unitId]`, `/edit` + `createUnit`/`updateUnit`/`archiveUnit`/`deleteUnit`.
6. Build tenant assignment: assign/edit/end-tenancy forms on the unit detail page + `assignTenant`/`updateTenant`/`endTenancy`, with a friendly error on the active-tenant uniqueness conflict.
7. Build the payment ledger: record/edit/delete forms on the unit detail page + `recordPayment`/`updatePayment`/`deletePayment`, rendering derived status via `lib/payment-status.ts`.
8. Build the cross-property `/payments` view using the same derivation helpers.
9. Rebrand: update `app/page.tsx`, `app/layout.tsx` metadata, `components/header.tsx` copy, remove the DOMPurify-only `serverExternalPackages` entry in `next.config.ts`.
10. Testing pass: Vitest coverage for all new Zod schemas and `lib/payment-status.ts`; manually verify cross-user ownership boundaries (attempt cross-landlord access, confirm it's rejected).
11. Polish: empty states, archive/unarchive UI, clear error messaging when a delete is blocked by existing history.

### Setup note

Since public sign-up is disabled, running the app for the first time (or against a fresh `data/app.db`) requires bootstrapping an admin account: `bun run create-admin <email> <name>`.
