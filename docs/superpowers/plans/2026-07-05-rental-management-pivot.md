# Rental Management Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the app from note-taking to rental property management per `SPEC.MD` — properties → units → tenants → rent payment ledger, with derived monthly paid/partial/unpaid status, all scoped to the authenticated landlord.

**Architecture:** Next.js App Router with server components for reads and colocated `'use server'` action files for writes. Raw SQL via the existing `bun:sqlite` singleton (`lib/db.ts`), no ORM/repository layer. Every non-`properties` table lacks a direct `user_id`, so every query up the `units → properties` / `tenants → units → properties` / `rent_payments → tenants → units → properties` chain must join back to `properties.user_id` for authorization (SPEC.MD §11).

**Tech Stack:** Next.js 16 (App Router), Bun runtime, TypeScript strict, TailwindCSS 4, `bun:sqlite`, Zod, better-auth, Vitest.

## Global Constraints

- All money (`rent_amount`, `amount`) is stored as **integer cents**; convert to/from dollars only at the UI boundary (SPEC.MD §9).
- Dates are ISO strings: full dates `YYYY-MM-DD`, calendar months `YYYY-MM` (SPEC.MD §9).
- No `ON DELETE CASCADE` anywhere; deletes are blocked at the DB level when children exist — the UI offers archive instead (SPEC.MD §5.1, §11).
- Every server action begins with `auth.api.getSession({ headers: await headers() })`; no session → redirect to `/authenticate` (SPEC.MD §7).
- Every mutation/read on `units`/`tenants`/`rent_payments` must use the ownership-chain SQL join from SPEC.MD §11 — never trust a client-supplied `unit_id` on `rent_payments`; always derive it server-side from the authorized `tenant_id`.
- Action results follow the existing typed-result convention: `{ error: { field?: string[], general?: string } }` via `zod.safeParse().error.flatten().fieldErrors`, or a success payload (matches `app/admin/users/actions.ts`).
- IDs are generated with `crypto.randomUUID()` (matches `app/notes/new/actions.ts`), not `nanoid` (being removed).
- Package manager is Bun; run tests with `bun run test:run`, dev server with `bun dev`.

---

## Task 1: Rewrite schema, delete the notes/TipTap feature, clean dependencies

**Files:**

- Modify: `lib/db.ts`
- Delete: `app/notes/` (entire directory), `app/p/` (entire directory), `components/rich-text-editor.tsx`, `components/share-toggle.tsx`, `components/tiptap-renderer.tsx`, `lib/sanitize.ts`, `lib/content.ts`
- Delete: `__tests__/components/tiptap-renderer.test.tsx`, `__tests__/lib/content.test.ts`, `__tests__/lib/sanitize.test.ts`
- Modify: `package.json` (remove `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`, `isomorphic-dompurify`, `nanoid` from `dependencies`; remove the `ignoreScripts`/`trustedDependencies` entries for `sharp`/`unrs-resolver` only if no longer referenced — leave them, they're unrelated to TipTap)
- Modify: `next.config.ts` (drop the DOMPurify-only `serverExternalPackages`)

**Interfaces:**

- Produces: `db` export from `lib/db.ts` (unchanged shape — `Database` instance from `bun:sqlite`), now backing `properties`, `units`, `tenants`, `rent_payments` instead of `notes`. All later tasks query this `db`.

- [ ] **Step 1: Delete the notes/TipTap files**

```bash
rm -rf app/notes app/p
rm -f components/rich-text-editor.tsx components/share-toggle.tsx components/tiptap-renderer.tsx
rm -f lib/sanitize.ts lib/content.ts
rm -f __tests__/components/tiptap-renderer.test.tsx __tests__/lib/content.test.ts __tests__/lib/sanitize.test.ts
```

- [ ] **Step 2: Rewrite `lib/db.ts`**

Replace the notes table/index/trigger block (everything from `// Create notes table` through the `update_notes_timestamp` trigger) with the four new tables. The better-auth tables and admin-plugin `ALTER TABLE` calls above that block are unchanged.

```typescript
// Create properties table
db.run(`
  CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES user(id)
  )
`);

// Create units table
db.run(`
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
  )
`);

// Create tenants table
db.run(`
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
  )
`);

// Create rent_payments table
db.run(`
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
  )
`);

// Create indexes
db.run(`CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_unit_id ON tenants(unit_id)`);
db.run(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_active_unit ON tenants(unit_id) WHERE is_active = 1`,
);
db.run(`CREATE INDEX IF NOT EXISTS idx_rent_payments_tenant_id ON rent_payments(tenant_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_rent_payments_unit_id ON rent_payments(unit_id)`);
db.run(
  `CREATE INDEX IF NOT EXISTS idx_rent_payments_tenant_period ON rent_payments(tenant_id, period)`,
);
db.run(`CREATE INDEX IF NOT EXISTS idx_rent_payments_period ON rent_payments(period)`);

// Auto-update updated_at columns
db.run(`
  CREATE TRIGGER IF NOT EXISTS update_properties_timestamp AFTER UPDATE ON properties
  BEGIN UPDATE properties SET updated_at = datetime('now') WHERE id = NEW.id; END
`);
db.run(`
  CREATE TRIGGER IF NOT EXISTS update_units_timestamp AFTER UPDATE ON units
  BEGIN UPDATE units SET updated_at = datetime('now') WHERE id = NEW.id; END
`);
db.run(`
  CREATE TRIGGER IF NOT EXISTS update_tenants_timestamp AFTER UPDATE ON tenants
  BEGIN UPDATE tenants SET updated_at = datetime('now') WHERE id = NEW.id; END
`);
db.run(`
  CREATE TRIGGER IF NOT EXISTS update_rent_payments_timestamp AFTER UPDATE ON rent_payments
  BEGIN UPDATE rent_payments SET updated_at = datetime('now') WHERE id = NEW.id; END
`);
```

- [ ] **Step 3: Remove the stale dev database so the new schema applies cleanly**

```bash
rm -f data/app.db data/app.db-wal data/app.db-shm
```

- [ ] **Step 4: Update `package.json`**

Remove these four lines from `dependencies`: `"@tiptap/pm"`, `"@tiptap/react"`, `"@tiptap/starter-kit"`, `"isomorphic-dompurify"`, `"nanoid"`. Leave everything else (including `better-auth`, `zod`) untouched.

- [ ] **Step 5: Update `next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 6: Reinstall and verify the app still boots**

```bash
bun install
bun run build
```

Expected: build fails on missing routes/imports referencing deleted files — that's expected at this point; confirm the _only_ errors are "module not found" for `app/notes`, `app/p`, `rich-text-editor`, `share-toggle`, `tiptap-renderer`, `sanitize`, `content` (these get fixed in later tasks as their remaining references — `app/dashboard/page.tsx`, `components/header.tsx` link — are rewritten). If `lib/db.ts` itself throws, fix the schema before proceeding.

- [ ] **Step 7: Commit**

```bash
git add lib/db.ts package.json next.config.ts
git add -u app/notes app/p components/rich-text-editor.tsx components/share-toggle.tsx components/tiptap-renderer.tsx lib/sanitize.ts lib/content.ts __tests__/components/tiptap-renderer.test.tsx __tests__/lib/content.test.ts __tests__/lib/sanitize.test.ts
git commit -m "chore: replace notes schema with rental management schema"
```

---

## Task 2: Validation schemas and payment-status helpers

**Files:**

- Modify: `lib/validation.ts`
- Create: `lib/money.ts`
- Create: `lib/payment-status.ts`
- Test: `__tests__/lib/payment-status.test.ts`
- Test: `__tests__/lib/money.test.ts`
- Modify: `__tests__/lib/validation.test.ts` (remove note-schema tests, add new ones)

**Interfaces:**

- Produces: `createPropertySchema`, `updatePropertySchema`, `createUnitSchema`, `updateUnitSchema`, `assignTenantSchema`, `updateTenantSchema`, `endTenancySchema`, `recordPaymentSchema`, `updatePaymentSchema` (all `zod` schemas, all fields as `string` inputs from `FormData` where numeric/date fields are `z.coerce`d).
- Produces: `dollarsToCents(input: string): number`, `formatCents(cents: number): string` from `lib/money.ts`.
- Produces: `computePaymentStatus(totalPaid: number, rentAmount: number): 'unpaid' | 'partial' | 'paid'`, `isLeaseActiveForPeriod(leaseStartDate: string, leaseEndDate: string | null, period: string): boolean` from `lib/payment-status.ts`.
- Consumes: nothing (pure/leaf modules).

- [ ] **Step 1: Write failing tests for `lib/payment-status.ts`**

```typescript
// __tests__/lib/payment-status.test.ts
import { describe, expect, it } from 'vitest';
import { computePaymentStatus, isLeaseActiveForPeriod } from '@/lib/payment-status';

describe('computePaymentStatus', () => {
  it('returns unpaid when nothing has been paid', () => {
    expect(computePaymentStatus(0, 150000)).toBe('unpaid');
  });

  it('returns partial when paid amount is less than rent', () => {
    expect(computePaymentStatus(50000, 150000)).toBe('partial');
  });

  it('returns paid when paid amount equals rent', () => {
    expect(computePaymentStatus(150000, 150000)).toBe('paid');
  });

  it('returns paid when paid amount exceeds rent', () => {
    expect(computePaymentStatus(200000, 150000)).toBe('paid');
  });
});

describe('isLeaseActiveForPeriod', () => {
  it('is true for a period within an open-ended lease', () => {
    expect(isLeaseActiveForPeriod('2026-01-01', null, '2026-06')).toBe(true);
  });

  it('is false for a period before lease start', () => {
    expect(isLeaseActiveForPeriod('2026-03-01', null, '2026-02')).toBe(false);
  });

  it('is true for a period on the lease start month', () => {
    expect(isLeaseActiveForPeriod('2026-03-15', null, '2026-03')).toBe(true);
  });

  it('is true for a period on the lease end month', () => {
    expect(isLeaseActiveForPeriod('2026-01-01', '2026-06-15', '2026-06')).toBe(true);
  });

  it('is false for a period after lease end', () => {
    expect(isLeaseActiveForPeriod('2026-01-01', '2026-06-15', '2026-07')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run __tests__/lib/payment-status.test.ts`
Expected: FAIL — `Cannot find module '@/lib/payment-status'`

- [ ] **Step 3: Implement `lib/payment-status.ts`**

```typescript
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export function computePaymentStatus(totalPaid: number, rentAmount: number): PaymentStatus {
  if (totalPaid <= 0) return 'unpaid';
  if (totalPaid < rentAmount) return 'partial';
  return 'paid';
}

export function isLeaseActiveForPeriod(
  leaseStartDate: string,
  leaseEndDate: string | null,
  period: string,
): boolean {
  const startPeriod = leaseStartDate.slice(0, 7);
  if (period < startPeriod) return false;
  if (leaseEndDate) {
    const endPeriod = leaseEndDate.slice(0, 7);
    if (period > endPeriod) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run __tests__/lib/payment-status.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Write failing tests for `lib/money.ts`**

```typescript
// __tests__/lib/money.test.ts
import { describe, expect, it } from 'vitest';
import { dollarsToCents, formatCents } from '@/lib/money';

describe('dollarsToCents', () => {
  it('converts a whole dollar string to cents', () => {
    expect(dollarsToCents('1500')).toBe(150000);
  });

  it('converts a string with cents to the correct integer', () => {
    expect(dollarsToCents('1500.5')).toBe(150050);
  });

  it('rounds fractional cents', () => {
    expect(dollarsToCents('10.005')).toBe(1001);
  });
});

describe('formatCents', () => {
  it('formats cents as a dollar string with two decimals', () => {
    expect(formatCents(150000)).toBe('$1,500.00');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test:run __tests__/lib/money.test.ts`
Expected: FAIL — `Cannot find module '@/lib/money'`

- [ ] **Step 7: Implement `lib/money.ts`**

```typescript
export function dollarsToCents(input: string): number {
  return Math.round(parseFloat(input) * 100);
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test:run __tests__/lib/money.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Rewrite `lib/validation.ts`**

Keep `createUserSchema` and `promoteToAdminSchema` (still used by `app/admin/users/actions.ts`); remove `createNoteSchema`, `updateNoteSchema`, `toggleSharingSchema`; add the rental schemas.

```typescript
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
});

export const promoteToAdminSchema = z.object({
  userId: z.string().min(1, 'User id is required'),
});

export const createPropertySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  address: z.string().min(1, 'Address is required').max(500, 'Address is too long'),
});

export const updatePropertySchema = createPropertySchema.extend({
  id: z.string().min(1, 'Property id is required'),
});

const centsField = z.coerce
  .number()
  .int('Must be a whole number of cents')
  .min(0, 'Must be zero or greater');

export const createUnitSchema = z.object({
  propertyId: z.string().min(1, 'Property id is required'),
  unitLabel: z.string().min(1, 'Unit label is required').max(100, 'Unit label is too long'),
  bedrooms: z.coerce.number().int().min(0, 'Bedrooms must be zero or greater'),
  bathrooms: z.coerce.number().min(0, 'Bathrooms must be zero or greater'),
  rentAmount: centsField,
});

export const updateUnitSchema = createUnitSchema.omit({ propertyId: true }).extend({
  id: z.string().min(1, 'Unit id is required'),
});

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)');
const optionalDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)')
  .optional()
  .or(z.literal(''));

export const assignTenantSchema = z.object({
  unitId: z.string().min(1, 'Unit id is required'),
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(50, 'Phone is too long').optional().or(z.literal('')),
  rentAmount: centsField,
  leaseStartDate: dateField,
  leaseEndDate: optionalDateField,
});

export const updateTenantSchema = z.object({
  id: z.string().min(1, 'Tenant id is required'),
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(50, 'Phone is too long').optional().or(z.literal('')),
  rentAmount: centsField,
  leaseStartDate: dateField,
  leaseEndDate: optionalDateField,
});

export const endTenancySchema = z.object({
  id: z.string().min(1, 'Tenant id is required'),
  leaseEndDate: dateField,
});

const periodField = z.string().regex(/^\d{4}-\d{2}$/, 'Must be a valid month (YYYY-MM)');

export const recordPaymentSchema = z.object({
  tenantId: z.string().min(1, 'Tenant id is required'),
  amount: z.coerce
    .number()
    .int('Must be a whole number of cents')
    .positive('Must be greater than zero'),
  period: periodField,
  paidDate: dateField,
  method: z.enum(['cash', 'bank_transfer', 'check', 'other']).optional().or(z.literal('')),
  notes: z.string().max(1000, 'Notes are too long').optional().or(z.literal('')),
});

export const updatePaymentSchema = recordPaymentSchema.omit({ tenantId: true }).extend({
  id: z.string().min(1, 'Payment id is required'),
});
```

- [ ] **Step 10: Update `__tests__/lib/validation.test.ts`**

Remove any `describe` blocks for `createNoteSchema`/`updateNoteSchema`/`toggleSharingSchema`. Keep the `createUserSchema`/`promoteToAdminSchema` blocks as-is. Add:

```typescript
import {
  createPropertySchema,
  createUnitSchema,
  assignTenantSchema,
  recordPaymentSchema,
} from '@/lib/validation';

describe('createPropertySchema', () => {
  it('accepts a valid property', () => {
    const result = createPropertySchema.safeParse({ name: 'Maple House', address: '123 Main St' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = createPropertySchema.safeParse({ name: '', address: '123 Main St' });
    expect(result.success).toBe(false);
  });
});

describe('createUnitSchema', () => {
  it('accepts a valid unit and coerces numeric fields', () => {
    const result = createUnitSchema.safeParse({
      propertyId: 'prop-1',
      unitLabel: 'Unit 2B',
      bedrooms: '2',
      bathrooms: '1.5',
      rentAmount: '150000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bedrooms).toBe(2);
      expect(result.data.rentAmount).toBe(150000);
    }
  });

  it('rejects a negative rent amount', () => {
    const result = createUnitSchema.safeParse({
      propertyId: 'prop-1',
      unitLabel: 'Unit 2B',
      bedrooms: '2',
      bathrooms: '1',
      rentAmount: '-100',
    });
    expect(result.success).toBe(false);
  });
});

describe('assignTenantSchema', () => {
  it('accepts a tenant with an open-ended lease', () => {
    const result = assignTenantSchema.safeParse({
      unitId: 'unit-1',
      name: 'Jane Tenant',
      email: '',
      phone: '',
      rentAmount: '150000',
      leaseStartDate: '2026-01-01',
      leaseEndDate: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed lease start date', () => {
    const result = assignTenantSchema.safeParse({
      unitId: 'unit-1',
      name: 'Jane Tenant',
      rentAmount: '150000',
      leaseStartDate: '01/01/2026',
    });
    expect(result.success).toBe(false);
  });
});

describe('recordPaymentSchema', () => {
  it('accepts a valid payment', () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: 'tenant-1',
      amount: '75000',
      period: '2026-03',
      paidDate: '2026-03-05',
      method: 'cash',
      notes: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a zero amount', () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: 'tenant-1',
      amount: '0',
      period: '2026-03',
      paidDate: '2026-03-05',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed period', () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: 'tenant-1',
      amount: '75000',
      period: '2026-3',
      paidDate: '2026-03-05',
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 11: Run all validation/payment-status/money tests**

Run: `bun run test:run`
Expected: PASS, no leftover references to deleted note schemas.

- [ ] **Step 12: Commit**

```bash
git add lib/validation.ts lib/money.ts lib/payment-status.ts __tests__/lib/validation.test.ts __tests__/lib/payment-status.test.ts __tests__/lib/money.test.ts
git commit -m "feat: add rental validation schemas and payment-status/money helpers"
```

---

## Task 3: Property CRUD

**Files:**

- Create: `app/dashboard/page.tsx` (rewrite, replacing the notes dashboard)
- Create: `app/properties/actions.ts`
- Create: `app/properties/new/page.tsx`
- Create: `app/properties/new/new-property-form.tsx`
- Create: `app/properties/[id]/page.tsx`
- Create: `app/properties/[id]/property-actions.tsx`
- Create: `app/properties/[id]/edit/page.tsx`
- Create: `app/properties/[id]/edit/edit-property-form.tsx`
- Create: `components/property-list.tsx`

**Interfaces:**

- Consumes: `db` from `lib/db.ts` (Task 1), `createPropertySchema`/`updatePropertySchema` from `lib/validation.ts` (Task 2), `auth` from `lib/auth.ts`.
- Produces: `createProperty`, `updateProperty`, `archiveProperty`, `deleteProperty` server actions in `app/properties/actions.ts`, each returning `{ error?: { name?: string[]; address?: string[]; general?: string } }` or redirecting on success. Later tasks (unit pages) link to `/properties/[id]`.

- [ ] **Step 1: Write `app/properties/actions.ts`**

```typescript
'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPropertySchema, updatePropertySchema } from '@/lib/validation';

export interface PropertyActionResult {
  error?: { name?: string[]; address?: string[]; general?: string };
}

export async function createProperty(
  _prevState: PropertyActionResult,
  formData: FormData,
): Promise<PropertyActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = createPropertySchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const id = crypto.randomUUID();
  db.run('INSERT INTO properties (id, user_id, name, address) VALUES (?, ?, ?, ?)', [
    id,
    session.user.id,
    parsed.data.name,
    parsed.data.address,
  ]);

  redirect(`/properties/${id}`);
}

export async function updateProperty(
  _prevState: PropertyActionResult,
  formData: FormData,
): Promise<PropertyActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = updatePropertySchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    address: formData.get('address'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const changes = db.run(
    'UPDATE properties SET name = ?, address = ? WHERE id = ? AND user_id = ?',
    [parsed.data.name, parsed.data.address, parsed.data.id, session.user.id],
  );
  if (changes.changes === 0) {
    return { error: { general: 'Property not found or access denied.' } };
  }

  redirect(`/properties/${parsed.data.id}`);
}

export async function archiveProperty(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  db.run("UPDATE properties SET archived_at = datetime('now') WHERE id = ? AND user_id = ?", [
    id,
    session.user.id,
  ]);

  redirect('/dashboard');
}

export interface DeletePropertyResult {
  error?: string;
}

export async function deleteProperty(
  _prevState: DeletePropertyResult,
  formData: FormData,
): Promise<DeletePropertyResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') {
    return { error: 'Invalid property id.' };
  }

  const property = db
    .query<
      { id: string },
      [string, string]
    >('SELECT id FROM properties WHERE id = ? AND user_id = ?')
    .get(id, session.user.id);
  if (!property) {
    return { error: 'Property not found or access denied.' };
  }

  const unitCount = db
    .query<{ count: number }, [string]>('SELECT COUNT(*) as count FROM units WHERE property_id = ?')
    .get(id);
  if (unitCount && unitCount.count > 0) {
    return { error: 'This property still has units — archive it instead of deleting.' };
  }

  db.run('DELETE FROM properties WHERE id = ? AND user_id = ?', [id, session.user.id]);
  redirect('/dashboard');
}
```

- [ ] **Step 2: Write `components/property-list.tsx`**

```typescript
import Link from 'next/link';

export interface PropertyListItem {
  id: string;
  name: string;
  address: string;
  unitCount: number;
}

export function PropertyList({ properties }: { properties: PropertyListItem[] }) {
  if (properties.length === 0) {
    return <p className='text-foreground/60'>No properties yet. Create your first one to get started.</p>;
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {properties.map((property) => (
        <Link
          key={property.id}
          href={`/properties/${property.id}`}
          className='block p-4 border border-border rounded-lg hover:bg-foreground/5 transition-colors'
        >
          <h2 className='font-semibold mb-1'>{property.name}</h2>
          <p className='text-sm text-foreground/60 mb-2'>{property.address}</p>
          <span className='text-sm text-foreground/40'>
            {property.unitCount} {property.unitCount === 1 ? 'unit' : 'units'}
          </span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `app/dashboard/page.tsx`**

```typescript
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { PropertyList, type PropertyListItem } from '@/components/property-list';

export default async function Dashboard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const properties = db
    .query<PropertyListItem, [string]>(
      `SELECT p.id, p.name, p.address, COUNT(u.id) as unitCount
       FROM properties p
       LEFT JOIN units u ON u.property_id = p.id AND u.archived_at IS NULL
       WHERE p.user_id = ? AND p.archived_at IS NULL
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
    )
    .all(session.user.id);

  return (
    <div className='p-8'>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold'>Properties</h1>
        <div className='flex gap-3'>
          <Link href='/payments' className='px-4 py-2 border border-border rounded-lg hover:bg-foreground/5'>
            Payments Overview
          </Link>
          <Link
            href='/properties/new'
            className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700'
          >
            New Property
          </Link>
        </div>
      </div>

      <PropertyList properties={properties} />
    </div>
  );
}
```

- [ ] **Step 4: Write `app/properties/new/new-property-form.tsx`**

```typescript
'use client';

import { useActionState } from 'react';
import { createProperty, type PropertyActionResult } from '../actions';

export function NewPropertyForm() {
  const [state, formAction, isPending] = useActionState<PropertyActionResult, FormData>(
    createProperty,
    {},
  );

  return (
    <form action={formAction} className='space-y-4'>
      {state.error?.general && (
        <div className='p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg'>
          {state.error.general}
        </div>
      )}

      <div>
        <label htmlFor='name' className='block text-sm font-medium mb-1'>
          Name
        </label>
        <input
          id='name'
          name='name'
          required
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {state.error?.name && <p className='mt-1 text-sm text-red-600'>{state.error.name[0]}</p>}
      </div>

      <div>
        <label htmlFor='address' className='block text-sm font-medium mb-1'>
          Address
        </label>
        <input
          id='address'
          name='address'
          required
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {state.error?.address && <p className='mt-1 text-sm text-red-600'>{state.error.address[0]}</p>}
      </div>

      <button
        type='submit'
        disabled={isPending}
        className='bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
      >
        {isPending ? 'Creating...' : 'Create Property'}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Write `app/properties/new/page.tsx`**

```typescript
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { NewPropertyForm } from './new-property-form';

export default async function NewPropertyPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  return (
    <div className='p-8 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>New Property</h1>
      <NewPropertyForm />
    </div>
  );
}
```

- [ ] **Step 6: Write `app/properties/[id]/property-actions.tsx`**

```typescript
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { archiveProperty, deleteProperty, type DeletePropertyResult } from '../actions';

export function PropertyActions({ propertyId }: { propertyId: string }) {
  const [state, deleteAction, isPending] = useActionState<DeletePropertyResult, FormData>(
    deleteProperty,
    {},
  );

  return (
    <div className='flex items-center gap-3'>
      <Link
        href={`/properties/${propertyId}/edit`}
        className='text-sm text-foreground/60 hover:text-foreground'
      >
        Edit
      </Link>
      <form action={archiveProperty}>
        <input type='hidden' name='id' value={propertyId} />
        <button type='submit' className='text-sm text-foreground/60 hover:text-foreground cursor-pointer'>
          Archive
        </button>
      </form>
      <form action={deleteAction}>
        <input type='hidden' name='id' value={propertyId} />
        <button
          type='submit'
          disabled={isPending}
          className='text-sm text-red-600 hover:text-red-800 cursor-pointer disabled:opacity-50'
        >
          Delete
        </button>
      </form>
      {state.error && <p className='text-sm text-red-600'>{state.error}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Write `app/properties/[id]/page.tsx`**

```typescript
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { PropertyActions } from './property-actions';
import { UnitList, type UnitListItem } from '@/components/unit-list';

type Params = Promise<{ id: string }>;

interface Property {
  id: string;
  name: string;
  address: string;
}

export default async function PropertyDetail({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id } = await params;

  const property = db
    .query<Property, [string, string]>(
      'SELECT id, name, address FROM properties WHERE id = ? AND user_id = ? AND archived_at IS NULL',
    )
    .get(id, session.user.id);
  if (!property) notFound();

  const units = db
    .query<UnitListItem, [string]>(
      `SELECT u.id, u.unit_label, u.bedrooms, u.bathrooms, u.rent_amount as rentAmount,
              t.name as tenantName
       FROM units u
       LEFT JOIN tenants t ON t.unit_id = u.id AND t.is_active = 1
       WHERE u.property_id = ? AND u.archived_at IS NULL
       ORDER BY u.created_at ASC`,
    )
    .all(property.id);

  return (
    <div className='p-8 max-w-3xl mx-auto'>
      <Link href='/dashboard' className='text-blue-600 hover:underline mb-4 inline-block'>
        &larr; Back to Properties
      </Link>

      <div className='flex items-start justify-between mb-2'>
        <div>
          <h1 className='text-3xl font-bold'>{property.name}</h1>
          <p className='text-foreground/60'>{property.address}</p>
        </div>
        <PropertyActions propertyId={property.id} />
      </div>

      <div className='flex items-center justify-between mt-8 mb-4'>
        <h2 className='text-xl font-semibold'>Units</h2>
        <Link
          href={`/properties/${property.id}/units/new`}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700'
        >
          Add Unit
        </Link>
      </div>

      <UnitList propertyId={property.id} units={units} />
    </div>
  );
}
```

- [ ] **Step 8: Write `app/properties/[id]/edit/edit-property-form.tsx`**

```typescript
'use client';

import { useActionState } from 'react';
import { updateProperty, type PropertyActionResult } from '../../actions';

export function EditPropertyForm({
  id,
  name,
  address,
}: {
  id: string;
  name: string;
  address: string;
}) {
  const [state, formAction, isPending] = useActionState<PropertyActionResult, FormData>(
    updateProperty,
    {},
  );

  return (
    <form action={formAction} className='space-y-4'>
      <input type='hidden' name='id' value={id} />

      {state.error?.general && (
        <div className='p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg'>
          {state.error.general}
        </div>
      )}

      <div>
        <label htmlFor='name' className='block text-sm font-medium mb-1'>
          Name
        </label>
        <input
          id='name'
          name='name'
          defaultValue={name}
          required
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {state.error?.name && <p className='mt-1 text-sm text-red-600'>{state.error.name[0]}</p>}
      </div>

      <div>
        <label htmlFor='address' className='block text-sm font-medium mb-1'>
          Address
        </label>
        <input
          id='address'
          name='address'
          defaultValue={address}
          required
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {state.error?.address && <p className='mt-1 text-sm text-red-600'>{state.error.address[0]}</p>}
      </div>

      <button
        type='submit'
        disabled={isPending}
        className='bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
      >
        {isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
```

- [ ] **Step 9: Write `app/properties/[id]/edit/page.tsx`**

```typescript
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { EditPropertyForm } from './edit-property-form';

type Params = Promise<{ id: string }>;

export default async function EditPropertyPage({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id } = await params;

  const property = db
    .query<{ id: string; name: string; address: string }, [string, string]>(
      'SELECT id, name, address FROM properties WHERE id = ? AND user_id = ?',
    )
    .get(id, session.user.id);
  if (!property) notFound();

  return (
    <div className='p-8 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Edit Property</h1>
      <EditPropertyForm id={property.id} name={property.name} address={property.address} />
    </div>
  );
}
```

Note: `components/unit-list.tsx` is created in Task 4 — `app/properties/[id]/page.tsx` will not compile until then. That's expected; this task's own tests (none — this is UI wired to a live DB) are verified manually in Task 4's step once units exist.

- [ ] **Step 10: Commit**

```bash
git add app/dashboard app/properties components/property-list.tsx
git commit -m "feat: add property CRUD (dashboard, create, view, edit, archive, delete)"
```

---

## Task 4: Unit CRUD

**Files:**

- Create: `components/unit-list.tsx`
- Create: `app/properties/[id]/units/new/actions.ts`
- Create: `app/properties/[id]/units/new/page.tsx`
- Create: `app/properties/[id]/units/new/new-unit-form.tsx`
- Create: `app/properties/[id]/units/[unitId]/actions.ts` (unit-scoped actions; tenant and payment actions are added to this same file in Tasks 5–6)
- Create: `app/properties/[id]/units/[unitId]/page.tsx`
- Create: `app/properties/[id]/units/[unitId]/unit-actions.tsx`
- Create: `app/properties/[id]/units/[unitId]/edit/page.tsx`
- Create: `app/properties/[id]/units/[unitId]/edit/edit-unit-form.tsx`

**Interfaces:**

- Consumes: `createUnitSchema`/`updateUnitSchema` from `lib/validation.ts`, `formatCents` from `lib/money.ts`.
- Produces: `createUnit`, `updateUnit`, `archiveUnit`, `deleteUnit` server actions. `UnitListItem` type (`{ id, unit_label, bedrooms, bathrooms, rentAmount, tenantName: string | null }`) consumed by `app/properties/[id]/page.tsx` (Task 3).

- [ ] **Step 1: Write `components/unit-list.tsx`**

```typescript
import Link from 'next/link';
import { formatCents } from '@/lib/money';

export interface UnitListItem {
  id: string;
  unit_label: string;
  bedrooms: number;
  bathrooms: number;
  rentAmount: number;
  tenantName: string | null;
}

export function UnitList({ propertyId, units }: { propertyId: string; units: UnitListItem[] }) {
  if (units.length === 0) {
    return <p className='text-foreground/60'>No units yet. Add the first one.</p>;
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      {units.map((unit) => (
        <Link
          key={unit.id}
          href={`/properties/${propertyId}/units/${unit.id}`}
          className='block p-4 border border-border rounded-lg hover:bg-foreground/5 transition-colors'
        >
          <h3 className='font-semibold mb-1'>{unit.unit_label}</h3>
          <p className='text-sm text-foreground/60 mb-1'>
            {unit.bedrooms} bd / {unit.bathrooms} ba &middot; {formatCents(unit.rentAmount)}/mo
          </p>
          <p className='text-sm text-foreground/40'>
            {unit.tenantName ? `Tenant: ${unit.tenantName}` : 'No tenant assigned'}
          </p>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `app/properties/[id]/units/new/actions.ts`**

```typescript
'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createUnitSchema } from '@/lib/validation';

export interface UnitActionResult {
  error?: {
    unitLabel?: string[];
    bedrooms?: string[];
    bathrooms?: string[];
    rentAmount?: string[];
    general?: string;
  };
}

export async function createUnit(
  _prevState: UnitActionResult,
  formData: FormData,
): Promise<UnitActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = createUnitSchema.safeParse({
    propertyId: formData.get('propertyId'),
    unitLabel: formData.get('unitLabel'),
    bedrooms: formData.get('bedrooms'),
    bathrooms: formData.get('bathrooms'),
    rentAmount: formData.get('rentAmount'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const property = db
    .query<
      { id: string },
      [string, string]
    >('SELECT id FROM properties WHERE id = ? AND user_id = ?')
    .get(parsed.data.propertyId, session.user.id);
  if (!property) {
    return { error: { general: 'Property not found or access denied.' } };
  }

  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO units (id, property_id, unit_label, bedrooms, bathrooms, rent_amount)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      property.id,
      parsed.data.unitLabel,
      parsed.data.bedrooms,
      parsed.data.bathrooms,
      parsed.data.rentAmount,
    ],
  );

  redirect(`/properties/${property.id}/units/${id}`);
}
```

- [ ] **Step 3: Write `app/properties/[id]/units/new/new-unit-form.tsx`**

```typescript
'use client';

import { useActionState } from 'react';
import { createUnit, type UnitActionResult } from './actions';

export function NewUnitForm({ propertyId }: { propertyId: string }) {
  const [state, formAction, isPending] = useActionState<UnitActionResult, FormData>(createUnit, {});

  return (
    <form action={formAction} className='space-y-4'>
      <input type='hidden' name='propertyId' value={propertyId} />

      {state.error?.general && (
        <div className='p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg'>
          {state.error.general}
        </div>
      )}

      <div>
        <label htmlFor='unitLabel' className='block text-sm font-medium mb-1'>
          Unit Label
        </label>
        <input
          id='unitLabel'
          name='unitLabel'
          required
          placeholder='Unit 2B'
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {state.error?.unitLabel && (
          <p className='mt-1 text-sm text-red-600'>{state.error.unitLabel[0]}</p>
        )}
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div>
          <label htmlFor='bedrooms' className='block text-sm font-medium mb-1'>
            Bedrooms
          </label>
          <input
            id='bedrooms'
            name='bedrooms'
            type='number'
            min='0'
            step='1'
            defaultValue='1'
            required
            className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
        <div>
          <label htmlFor='bathrooms' className='block text-sm font-medium mb-1'>
            Bathrooms
          </label>
          <input
            id='bathrooms'
            name='bathrooms'
            type='number'
            min='0'
            step='0.5'
            defaultValue='1'
            required
            className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
      </div>

      <div>
        <label htmlFor='rentAmountDollars' className='block text-sm font-medium mb-1'>
          Asking Rent ($/mo)
        </label>
        <input
          id='rentAmountDollars'
          name='rentAmountDollars'
          type='number'
          min='0'
          step='0.01'
          required
          onChange={(e) => {
            const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
            const hidden = e.currentTarget.form?.elements.namedItem('rentAmount') as HTMLInputElement | null;
            if (hidden) hidden.value = String(cents);
          }}
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        <input type='hidden' name='rentAmount' />
        {state.error?.rentAmount && (
          <p className='mt-1 text-sm text-red-600'>{state.error.rentAmount[0]}</p>
        )}
      </div>

      <button
        type='submit'
        disabled={isPending}
        className='bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
      >
        {isPending ? 'Creating...' : 'Add Unit'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Write `app/properties/[id]/units/new/page.tsx`**

```typescript
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NewUnitForm } from './new-unit-form';

type Params = Promise<{ id: string }>;

export default async function NewUnitPage({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id } = await params;

  const property = db
    .query<{ id: string }, [string, string]>('SELECT id FROM properties WHERE id = ? AND user_id = ?')
    .get(id, session.user.id);
  if (!property) notFound();

  return (
    <div className='p-8 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Add Unit</h1>
      <NewUnitForm propertyId={property.id} />
    </div>
  );
}
```

- [ ] **Step 5: Write `app/properties/[id]/units/[unitId]/actions.ts`**

This file will accumulate tenant (Task 5) and payment (Task 6) actions too; for this task it holds only unit actions.

```typescript
'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { updateUnitSchema } from '@/lib/validation';

export interface UnitActionResult {
  error?: {
    unitLabel?: string[];
    bedrooms?: string[];
    bathrooms?: string[];
    rentAmount?: string[];
    general?: string;
  };
}

async function findAuthorizedUnit(unitId: string, userId: string) {
  return db
    .query<{ id: string; property_id: string }, [string, string]>(
      `SELECT u.id, u.property_id FROM units u
       JOIN properties p ON p.id = u.property_id
       WHERE u.id = ? AND p.user_id = ?`,
    )
    .get(unitId, userId);
}

export async function updateUnit(
  _prevState: UnitActionResult,
  formData: FormData,
): Promise<UnitActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = updateUnitSchema.safeParse({
    id: formData.get('id'),
    unitLabel: formData.get('unitLabel'),
    bedrooms: formData.get('bedrooms'),
    bathrooms: formData.get('bathrooms'),
    rentAmount: formData.get('rentAmount'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const unit = await findAuthorizedUnit(parsed.data.id, session.user.id);
  if (!unit) {
    return { error: { general: 'Unit not found or access denied.' } };
  }

  db.run(
    'UPDATE units SET unit_label = ?, bedrooms = ?, bathrooms = ?, rent_amount = ? WHERE id = ?',
    [
      parsed.data.unitLabel,
      parsed.data.bedrooms,
      parsed.data.bathrooms,
      parsed.data.rentAmount,
      unit.id,
    ],
  );

  redirect(`/properties/${unit.property_id}/units/${unit.id}`);
}

export async function archiveUnit(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  const unit = await findAuthorizedUnit(id, session.user.id);
  if (!unit) return;

  db.run("UPDATE units SET archived_at = datetime('now') WHERE id = ?", [unit.id]);
  redirect(`/properties/${unit.property_id}`);
}

export interface DeleteUnitResult {
  error?: string;
}

export async function deleteUnit(
  _prevState: DeleteUnitResult,
  formData: FormData,
): Promise<DeleteUnitResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') {
    return { error: 'Invalid unit id.' };
  }

  const unit = await findAuthorizedUnit(id, session.user.id);
  if (!unit) {
    return { error: 'Unit not found or access denied.' };
  }

  const tenantCount = db
    .query<{ count: number }, [string]>('SELECT COUNT(*) as count FROM tenants WHERE unit_id = ?')
    .get(unit.id);
  if (tenantCount && tenantCount.count > 0) {
    return { error: 'This unit has tenant history — archive it instead of deleting.' };
  }

  db.run('DELETE FROM units WHERE id = ?', [unit.id]);
  redirect(`/properties/${unit.property_id}`);
}
```

- [ ] **Step 6: Write `app/properties/[id]/units/[unitId]/unit-actions.tsx`**

```typescript
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { archiveUnit, deleteUnit, type DeleteUnitResult } from './actions';

export function UnitActions({ propertyId, unitId }: { propertyId: string; unitId: string }) {
  const [state, deleteAction, isPending] = useActionState<DeleteUnitResult, FormData>(deleteUnit, {});

  return (
    <div className='flex items-center gap-3'>
      <Link
        href={`/properties/${propertyId}/units/${unitId}/edit`}
        className='text-sm text-foreground/60 hover:text-foreground'
      >
        Edit
      </Link>
      <form action={archiveUnit}>
        <input type='hidden' name='id' value={unitId} />
        <button type='submit' className='text-sm text-foreground/60 hover:text-foreground cursor-pointer'>
          Archive
        </button>
      </form>
      <form action={deleteAction}>
        <input type='hidden' name='id' value={unitId} />
        <button
          type='submit'
          disabled={isPending}
          className='text-sm text-red-600 hover:text-red-800 cursor-pointer disabled:opacity-50'
        >
          Delete
        </button>
      </form>
      {state.error && <p className='text-sm text-red-600'>{state.error}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Write `app/properties/[id]/units/[unitId]/page.tsx`** (minimal version — tenant/payment sections are added in Tasks 5–6)

```typescript
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatCents } from '@/lib/money';
import { UnitActions } from './unit-actions';

type Params = Promise<{ id: string; unitId: string }>;

interface Unit {
  id: string;
  property_id: string;
  unit_label: string;
  bedrooms: number;
  bathrooms: number;
  rent_amount: number;
}

export default async function UnitDetail({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id, unitId } = await params;

  const unit = db
    .query<Unit, [string, string, string]>(
      `SELECT u.id, u.property_id, u.unit_label, u.bedrooms, u.bathrooms, u.rent_amount
       FROM units u
       JOIN properties p ON p.id = u.property_id
       WHERE u.id = ? AND u.property_id = ? AND p.user_id = ?`,
    )
    .get(unitId, id, session.user.id);
  if (!unit) notFound();

  return (
    <div className='p-8 max-w-3xl mx-auto'>
      <Link href={`/properties/${unit.property_id}`} className='text-blue-600 hover:underline mb-4 inline-block'>
        &larr; Back to Property
      </Link>

      <div className='flex items-start justify-between mb-6'>
        <div>
          <h1 className='text-3xl font-bold'>{unit.unit_label}</h1>
          <p className='text-foreground/60'>
            {unit.bedrooms} bd / {unit.bathrooms} ba &middot; {formatCents(unit.rent_amount)}/mo asking
          </p>
        </div>
        <UnitActions propertyId={unit.property_id} unitId={unit.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Write `app/properties/[id]/units/[unitId]/edit/edit-unit-form.tsx`**

```typescript
'use client';

import { useActionState } from 'react';
import { updateUnit, type UnitActionResult } from '../actions';

export function EditUnitForm({
  id,
  unitLabel,
  bedrooms,
  bathrooms,
  rentAmount,
}: {
  id: string;
  unitLabel: string;
  bedrooms: number;
  bathrooms: number;
  rentAmount: number;
}) {
  const [state, formAction, isPending] = useActionState<UnitActionResult, FormData>(updateUnit, {});

  return (
    <form action={formAction} className='space-y-4'>
      <input type='hidden' name='id' value={id} />

      {state.error?.general && (
        <div className='p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg'>
          {state.error.general}
        </div>
      )}

      <div>
        <label htmlFor='unitLabel' className='block text-sm font-medium mb-1'>
          Unit Label
        </label>
        <input
          id='unitLabel'
          name='unitLabel'
          defaultValue={unitLabel}
          required
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {state.error?.unitLabel && (
          <p className='mt-1 text-sm text-red-600'>{state.error.unitLabel[0]}</p>
        )}
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div>
          <label htmlFor='bedrooms' className='block text-sm font-medium mb-1'>
            Bedrooms
          </label>
          <input
            id='bedrooms'
            name='bedrooms'
            type='number'
            min='0'
            step='1'
            defaultValue={bedrooms}
            required
            className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
        <div>
          <label htmlFor='bathrooms' className='block text-sm font-medium mb-1'>
            Bathrooms
          </label>
          <input
            id='bathrooms'
            name='bathrooms'
            type='number'
            min='0'
            step='0.5'
            defaultValue={bathrooms}
            required
            className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
      </div>

      <div>
        <label htmlFor='rentAmountDollars' className='block text-sm font-medium mb-1'>
          Asking Rent ($/mo)
        </label>
        <input
          id='rentAmountDollars'
          name='rentAmountDollars'
          type='number'
          min='0'
          step='0.01'
          defaultValue={(rentAmount / 100).toFixed(2)}
          required
          onChange={(e) => {
            const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
            const hidden = e.currentTarget.form?.elements.namedItem('rentAmount') as HTMLInputElement | null;
            if (hidden) hidden.value = String(cents);
          }}
          className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        <input type='hidden' name='rentAmount' defaultValue={rentAmount} />
        {state.error?.rentAmount && (
          <p className='mt-1 text-sm text-red-600'>{state.error.rentAmount[0]}</p>
        )}
      </div>

      <button
        type='submit'
        disabled={isPending}
        className='bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
      >
        {isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
```

- [ ] **Step 9: Write `app/properties/[id]/units/[unitId]/edit/page.tsx`**

```typescript
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { EditUnitForm } from './edit-unit-form';

type Params = Promise<{ id: string; unitId: string }>;

interface Unit {
  id: string;
  unit_label: string;
  bedrooms: number;
  bathrooms: number;
  rent_amount: number;
}

export default async function EditUnitPage({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id, unitId } = await params;

  const unit = db
    .query<Unit, [string, string, string]>(
      `SELECT u.id, u.unit_label, u.bedrooms, u.bathrooms, u.rent_amount
       FROM units u
       JOIN properties p ON p.id = u.property_id
       WHERE u.id = ? AND u.property_id = ? AND p.user_id = ?`,
    )
    .get(unitId, id, session.user.id);
  if (!unit) notFound();

  return (
    <div className='p-8 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Edit Unit</h1>
      <EditUnitForm
        id={unit.id}
        unitLabel={unit.unit_label}
        bedrooms={unit.bedrooms}
        bathrooms={unit.bathrooms}
        rentAmount={unit.rent_amount}
      />
    </div>
  );
}
```

- [ ] **Step 10: Build and manually verify property→unit flow**

Run: `bun run build && bun dev`
In the browser: log in (create an admin via `bun run create-admin you@example.com "You"` if no account exists), create a property, add a unit, confirm it appears on the property page, edit it, archive it, confirm it disappears from the property page.

- [ ] **Step 11: Commit**

```bash
git add app/properties/[id]/units components/unit-list.tsx
git commit -m "feat: add unit CRUD (create, view, edit, archive, delete)"
```

---

## Task 5: Tenant assignment

**Files:**

- Modify: `app/properties/[id]/units/[unitId]/actions.ts` (add `assignTenant`, `updateTenant`, `endTenancy`)
- Create: `components/tenant-card.tsx`
- Modify: `app/properties/[id]/units/[unitId]/page.tsx` (render tenant card + tenancy history)

**Interfaces:**

- Consumes: `assignTenantSchema`, `updateTenantSchema`, `endTenancySchema` from `lib/validation.ts`.
- Produces: `assignTenant`, `updateTenant`, `endTenancy` server actions, appended to the same `actions.ts` as Task 4's unit actions. `TenantCard` component consumed by the unit detail page.

- [ ] **Step 1: Append tenant actions to `app/properties/[id]/units/[unitId]/actions.ts`**

```typescript
import { assignTenantSchema, updateTenantSchema, endTenancySchema } from '@/lib/validation';

export interface TenantActionResult {
  error?: {
    name?: string[];
    email?: string[];
    phone?: string[];
    rentAmount?: string[];
    leaseStartDate?: string[];
    leaseEndDate?: string[];
    general?: string;
  };
}

export async function assignTenant(
  _prevState: TenantActionResult,
  formData: FormData,
): Promise<TenantActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = assignTenantSchema.safeParse({
    unitId: formData.get('unitId'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    rentAmount: formData.get('rentAmount'),
    leaseStartDate: formData.get('leaseStartDate'),
    leaseEndDate: formData.get('leaseEndDate'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const unit = await findAuthorizedUnit(parsed.data.unitId, session.user.id);
  if (!unit) {
    return { error: { general: 'Unit not found or access denied.' } };
  }

  const id = crypto.randomUUID();
  try {
    db.run(
      `INSERT INTO tenants (id, unit_id, name, email, phone, rent_amount, lease_start_date, lease_end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        unit.id,
        parsed.data.name,
        parsed.data.email || null,
        parsed.data.phone || null,
        parsed.data.rentAmount,
        parsed.data.leaseStartDate,
        parsed.data.leaseEndDate || null,
      ],
    );
  } catch {
    return { error: { general: 'This unit already has an active tenant.' } };
  }

  redirect(`/properties/${unit.property_id}/units/${unit.id}`);
}

async function findAuthorizedTenant(tenantId: string, userId: string) {
  return db
    .query<{ id: string; unit_id: string; property_id: string }, [string, string]>(
      `SELECT t.id, t.unit_id, u.property_id FROM tenants t
       JOIN units u ON u.id = t.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE t.id = ? AND p.user_id = ?`,
    )
    .get(tenantId, userId);
}

export async function updateTenant(
  _prevState: TenantActionResult,
  formData: FormData,
): Promise<TenantActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = updateTenantSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    rentAmount: formData.get('rentAmount'),
    leaseStartDate: formData.get('leaseStartDate'),
    leaseEndDate: formData.get('leaseEndDate'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const tenant = await findAuthorizedTenant(parsed.data.id, session.user.id);
  if (!tenant) {
    return { error: { general: 'Tenant not found or access denied.' } };
  }

  db.run(
    `UPDATE tenants SET name = ?, email = ?, phone = ?, rent_amount = ?, lease_start_date = ?, lease_end_date = ?
     WHERE id = ?`,
    [
      parsed.data.name,
      parsed.data.email || null,
      parsed.data.phone || null,
      parsed.data.rentAmount,
      parsed.data.leaseStartDate,
      parsed.data.leaseEndDate || null,
      tenant.id,
    ],
  );

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}

export async function endTenancy(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = endTenancySchema.safeParse({
    id: formData.get('id'),
    leaseEndDate: formData.get('leaseEndDate'),
  });
  if (!parsed.success) return;

  const tenant = await findAuthorizedTenant(parsed.data.id, session.user.id);
  if (!tenant) return;

  db.run('UPDATE tenants SET is_active = 0, lease_end_date = ? WHERE id = ?', [
    parsed.data.leaseEndDate,
    tenant.id,
  ]);

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}
```

- [ ] **Step 2: Write `components/tenant-card.tsx`**

```typescript
'use client';

import { useActionState } from 'react';
import { formatCents } from '@/lib/money';
import { endTenancy, assignTenant, type TenantActionResult } from '@/app/properties/[id]/units/[unitId]/actions';

export interface Tenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rent_amount: number;
  lease_start_date: string;
  lease_end_date: string | null;
  is_active: number;
}

export function TenantCard({ unitId, tenant }: { unitId: string; tenant: Tenant | null }) {
  const [assignState, assignAction, assignPending] = useActionState<TenantActionResult, FormData>(
    assignTenant,
    {},
  );

  if (!tenant) {
    return (
      <div className='border border-border rounded-lg p-4'>
        <h3 className='font-semibold mb-3'>No tenant assigned</h3>
        <form action={assignAction} className='space-y-3'>
          <input type='hidden' name='unitId' value={unitId} />
          {assignState.error?.general && (
            <p className='text-sm text-red-600'>{assignState.error.general}</p>
          )}
          <div className='grid grid-cols-2 gap-3'>
            <input name='name' placeholder='Tenant name' required className='px-3 py-2 border border-border rounded-lg' />
            <input name='email' type='email' placeholder='Email (optional)' className='px-3 py-2 border border-border rounded-lg' />
            <input name='phone' placeholder='Phone (optional)' className='px-3 py-2 border border-border rounded-lg' />
            <input name='rentAmountDollars' type='number' step='0.01' min='0' placeholder='Rent $/mo' required
              onChange={(e) => {
                const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
                const hidden = e.currentTarget.form?.elements.namedItem('rentAmount') as HTMLInputElement | null;
                if (hidden) hidden.value = String(cents);
              }}
              className='px-3 py-2 border border-border rounded-lg' />
            <input type='hidden' name='rentAmount' />
            <input name='leaseStartDate' type='date' required className='px-3 py-2 border border-border rounded-lg' />
            <input name='leaseEndDate' type='date' className='px-3 py-2 border border-border rounded-lg' />
          </div>
          <button type='submit' disabled={assignPending} className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'>
            {assignPending ? 'Assigning...' : 'Assign Tenant'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className='border border-border rounded-lg p-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h3 className='font-semibold'>{tenant.name}</h3>
          <p className='text-sm text-foreground/60'>
            {tenant.email || 'No email'} &middot; {tenant.phone || 'No phone'}
          </p>
          <p className='text-sm text-foreground/60'>
            Rent: {formatCents(tenant.rent_amount)}/mo &middot; Lease: {tenant.lease_start_date} to{' '}
            {tenant.lease_end_date || 'ongoing'}
          </p>
        </div>
        <form
          action={async (formData) => {
            formData.set('id', tenant.id);
            formData.set('leaseEndDate', new Date().toISOString().slice(0, 10));
            await endTenancy(formData);
          }}
        >
          <button type='submit' className='text-sm text-red-600 hover:text-red-800 cursor-pointer'>
            End Tenancy
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Modify `app/properties/[id]/units/[unitId]/page.tsx`** to render the tenant card and tenancy history

Add these imports:

```typescript
import { TenantCard, type Tenant } from '@/components/tenant-card';
```

Add this query after the `unit` lookup (before the `return`):

```typescript
const activeTenant =
  db
    .query<Tenant, [string]>(
      `SELECT id, name, email, phone, rent_amount, lease_start_date, lease_end_date, is_active
       FROM tenants WHERE unit_id = ? AND is_active = 1`,
    )
    .get(unit.id) ?? null;

const tenantHistory = db
  .query<Tenant, [string]>(
    `SELECT id, name, email, phone, rent_amount, lease_start_date, lease_end_date, is_active
       FROM tenants WHERE unit_id = ? ORDER BY lease_start_date DESC`,
  )
  .all(unit.id);
```

Add this JSX after the header `<div>` block (before the closing `</div>` of the page):

```typescript
      <div className='mb-8'>
        <h2 className='text-xl font-semibold mb-3'>Current Tenant</h2>
        <TenantCard unitId={unit.id} tenant={activeTenant} />
      </div>

      {tenantHistory.length > 0 && (
        <div className='mb-8'>
          <h2 className='text-xl font-semibold mb-3'>Tenancy History</h2>
          <ul className='space-y-2'>
            {tenantHistory.map((t) => (
              <li key={t.id} className='text-sm text-foreground/60 border-b border-border/50 pb-2'>
                {t.name} &middot; {t.lease_start_date} to {t.lease_end_date || 'ongoing'}
                {t.is_active === 1 && <span className='ml-2 text-green-600'>(current)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
```

- [ ] **Step 4: Build and manually verify tenant assignment**

Run: `bun run build && bun dev`
In the browser: assign a tenant to a unit, confirm the unit list on the property page shows the tenant name, try assigning a second tenant to the same unit (expect the friendly "already has an active tenant" error), end the tenancy, confirm it moves to tenancy history and the unit becomes assignable again.

- [ ] **Step 5: Commit**

```bash
git add app/properties/[id]/units/[unitId]/actions.ts app/properties/[id]/units/[unitId]/page.tsx components/tenant-card.tsx
git commit -m "feat: add tenant assignment, update, and end-tenancy"
```

---

## Task 6: Rent payment ledger

**Files:**

- Modify: `app/properties/[id]/units/[unitId]/actions.ts` (add `recordPayment`, `updatePayment`, `deletePayment`)
- Create: `components/payment-status-badge.tsx`
- Create: `components/payment-ledger.tsx`
- Modify: `app/properties/[id]/units/[unitId]/page.tsx` (render payment ledger + current-month status)

**Interfaces:**

- Consumes: `recordPaymentSchema`, `updatePaymentSchema` from `lib/validation.ts`, `computePaymentStatus` from `lib/payment-status.ts`, `formatCents` from `lib/money.ts`.
- Produces: `recordPayment`, `updatePayment`, `deletePayment` server actions. `PaymentLedger` and `PaymentStatusBadge` components, both reused by Task 7's `/payments` view (the badge; the ledger logic pattern for status computation).

- [ ] **Step 1: Write `components/payment-status-badge.tsx`**

```typescript
import type { PaymentStatus } from '@/lib/payment-status';

const STYLES: Record<PaymentStatus, string> = {
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  unpaid: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const LABELS: Record<PaymentStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 2: Append payment actions to `app/properties/[id]/units/[unitId]/actions.ts`**

```typescript
import { recordPaymentSchema, updatePaymentSchema } from '@/lib/validation';

export interface PaymentActionResult {
  error?: {
    amount?: string[];
    period?: string[];
    paidDate?: string[];
    method?: string[];
    notes?: string[];
    general?: string;
  };
}

export async function recordPayment(
  _prevState: PaymentActionResult,
  formData: FormData,
): Promise<PaymentActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = recordPaymentSchema.safeParse({
    tenantId: formData.get('tenantId'),
    amount: formData.get('amount'),
    period: formData.get('period'),
    paidDate: formData.get('paidDate'),
    method: formData.get('method'),
    notes: formData.get('notes'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const tenant = await findAuthorizedTenant(parsed.data.tenantId, session.user.id);
  if (!tenant) {
    return { error: { general: 'Tenant not found or access denied.' } };
  }

  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO rent_payments (id, tenant_id, unit_id, amount, period, paid_date, method, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenant.id,
      tenant.unit_id,
      parsed.data.amount,
      parsed.data.period,
      parsed.data.paidDate,
      parsed.data.method || null,
      parsed.data.notes || null,
    ],
  );

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}

async function findAuthorizedPayment(paymentId: string, userId: string) {
  return db
    .query<
      { id: string; tenant_id: string; unit_id: string; property_id: string },
      [string, string]
    >(
      `SELECT rp.id, rp.tenant_id, rp.unit_id, u.property_id FROM rent_payments rp
       JOIN tenants t ON t.id = rp.tenant_id
       JOIN units u ON u.id = t.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE rp.id = ? AND p.user_id = ?`,
    )
    .get(paymentId, userId);
}

export async function updatePayment(
  _prevState: PaymentActionResult,
  formData: FormData,
): Promise<PaymentActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = updatePaymentSchema.safeParse({
    id: formData.get('id'),
    amount: formData.get('amount'),
    period: formData.get('period'),
    paidDate: formData.get('paidDate'),
    method: formData.get('method'),
    notes: formData.get('notes'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const payment = await findAuthorizedPayment(parsed.data.id, session.user.id);
  if (!payment) {
    return { error: { general: 'Payment not found or access denied.' } };
  }

  db.run(
    'UPDATE rent_payments SET amount = ?, period = ?, paid_date = ?, method = ?, notes = ? WHERE id = ?',
    [
      parsed.data.amount,
      parsed.data.period,
      parsed.data.paidDate,
      parsed.data.method || null,
      parsed.data.notes || null,
      payment.id,
    ],
  );

  redirect(`/properties/${payment.property_id}/units/${payment.unit_id}`);
}

export async function deletePayment(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  const payment = await findAuthorizedPayment(id, session.user.id);
  if (!payment) return;

  db.run('DELETE FROM rent_payments WHERE id = ?', [payment.id]);
  redirect(`/properties/${payment.property_id}/units/${payment.unit_id}`);
}
```

- [ ] **Step 3: Write `components/payment-ledger.tsx`**

```typescript
'use client';

import { useActionState } from 'react';
import { formatCents } from '@/lib/money';
import { recordPayment, deletePayment, type PaymentActionResult } from '@/app/properties/[id]/units/[unitId]/actions';

export interface Payment {
  id: string;
  amount: number;
  period: string;
  paid_date: string;
  method: string | null;
  notes: string | null;
}

export function PaymentLedger({ tenantId, payments }: { tenantId: string; payments: Payment[] }) {
  const [state, formAction, isPending] = useActionState<PaymentActionResult, FormData>(
    recordPayment,
    {},
  );

  return (
    <div className='space-y-4'>
      <form action={formAction} className='flex flex-wrap gap-3 items-end'>
        <input type='hidden' name='tenantId' value={tenantId} />
        {state.error?.general && <p className='w-full text-sm text-red-600'>{state.error.general}</p>}
        <div>
          <label className='block text-xs mb-1'>Period</label>
          <input name='period' type='month' required className='px-3 py-2 border border-border rounded-lg' />
        </div>
        <div>
          <label className='block text-xs mb-1'>Amount ($)</label>
          <input
            name='amountDollars'
            type='number'
            step='0.01'
            min='0.01'
            required
            onChange={(e) => {
              const cents = Math.round(parseFloat(e.currentTarget.value || '0') * 100);
              const hidden = e.currentTarget.form?.elements.namedItem('amount') as HTMLInputElement | null;
              if (hidden) hidden.value = String(cents);
            }}
            className='px-3 py-2 border border-border rounded-lg'
          />
          <input type='hidden' name='amount' />
        </div>
        <div>
          <label className='block text-xs mb-1'>Paid Date</label>
          <input name='paidDate' type='date' required className='px-3 py-2 border border-border rounded-lg' />
        </div>
        <div>
          <label className='block text-xs mb-1'>Method</label>
          <select name='method' className='px-3 py-2 border border-border rounded-lg'>
            <option value=''>—</option>
            <option value='cash'>Cash</option>
            <option value='bank_transfer'>Bank Transfer</option>
            <option value='check'>Check</option>
            <option value='other'>Other</option>
          </select>
        </div>
        <button
          type='submit'
          disabled={isPending}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50'
        >
          {isPending ? 'Recording...' : 'Record Payment'}
        </button>
      </form>

      {payments.length === 0 ? (
        <p className='text-foreground/60 text-sm'>No payments recorded yet.</p>
      ) : (
        <table className='w-full text-sm border-collapse'>
          <thead>
            <tr className='text-left border-b border-border'>
              <th className='py-2 pr-4'>Period</th>
              <th className='py-2 pr-4'>Amount</th>
              <th className='py-2 pr-4'>Paid Date</th>
              <th className='py-2 pr-4'>Method</th>
              <th className='py-2 pr-4'></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className='border-b border-border/50'>
                <td className='py-2 pr-4'>{p.period}</td>
                <td className='py-2 pr-4'>{formatCents(p.amount)}</td>
                <td className='py-2 pr-4'>{p.paid_date}</td>
                <td className='py-2 pr-4'>{p.method || '—'}</td>
                <td className='py-2 pr-4'>
                  <form
                    action={async (formData) => {
                      formData.set('id', p.id);
                      await deletePayment(formData);
                    }}
                  >
                    <button type='submit' className='text-red-600 hover:text-red-800 cursor-pointer'>
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Modify `app/properties/[id]/units/[unitId]/page.tsx`** to render the ledger and current-month status

Add imports:

```typescript
import { PaymentLedger, type Payment } from '@/components/payment-ledger';
import { PaymentStatusBadge } from '@/components/payment-status-badge';
import { computePaymentStatus, isLeaseActiveForPeriod } from '@/lib/payment-status';
```

Add after the `tenantHistory` query:

```typescript
const currentPeriod = new Date().toISOString().slice(0, 7);

const payments = activeTenant
  ? db
      .query<Payment, [string]>(
        `SELECT id, amount, period, paid_date, method, notes FROM rent_payments
           WHERE tenant_id = ? ORDER BY period DESC, paid_date DESC`,
      )
      .all(activeTenant.id)
  : [];

const currentPeriodTotal = payments
  .filter((p) => p.period === currentPeriod)
  .reduce((sum, p) => sum + p.amount, 0);

const currentStatus =
  activeTenant &&
  isLeaseActiveForPeriod(activeTenant.lease_start_date, activeTenant.lease_end_date, currentPeriod)
    ? computePaymentStatus(currentPeriodTotal, activeTenant.rent_amount)
    : null;
```

Add JSX after the tenancy history block:

```typescript
      {activeTenant && (
        <div className='mb-4 flex items-center gap-2'>
          <span className='text-sm text-foreground/60'>This month ({currentPeriod}):</span>
          {currentStatus && <PaymentStatusBadge status={currentStatus} />}
        </div>
      )}

      {activeTenant && (
        <div>
          <h2 className='text-xl font-semibold mb-3'>Payment Ledger</h2>
          <PaymentLedger tenantId={activeTenant.id} payments={payments} />
        </div>
      )}
```

- [ ] **Step 5: Build and manually verify the payment ledger**

Run: `bun run build && bun dev`
In the browser: record a partial payment for the current month (expect "Partial" badge), record another payment bringing the total to/above rent (expect "Paid" badge), delete a payment and confirm the status recalculates.

- [ ] **Step 6: Commit**

```bash
git add app/properties/[id]/units/[unitId]/actions.ts app/properties/[id]/units/[unitId]/page.tsx components/payment-ledger.tsx components/payment-status-badge.tsx
git commit -m "feat: add rent payment ledger with derived monthly status"
```

---

## Task 7: Cross-property `/payments` view

**Files:**

- Create: `components/month-picker.tsx`
- Create: `app/payments/page.tsx`

**Interfaces:**

- Consumes: `PaymentStatusBadge` (Task 6), `computePaymentStatus`/`isLeaseActiveForPeriod` (Task 2), `formatCents` (Task 2), `db`/`auth`.

- [ ] **Step 1: Write `components/month-picker.tsx`**

```typescript
'use client';

import { useRouter } from 'next/navigation';

export function MonthPicker({ value }: { value: string }) {
  const router = useRouter();

  return (
    <input
      type='month'
      value={value}
      onChange={(e) => router.push(`/payments?month=${e.target.value}`)}
      className='px-3 py-2 border border-border rounded-lg'
    />
  );
}
```

- [ ] **Step 2: Write `app/payments/page.tsx`**

```typescript
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatCents } from '@/lib/money';
import { computePaymentStatus, isLeaseActiveForPeriod } from '@/lib/payment-status';
import { PaymentStatusBadge } from '@/components/payment-status-badge';
import { MonthPicker } from '@/components/month-picker';

type SearchParams = Promise<{ month?: string }>;

interface Row {
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitLabel: string;
  tenantId: string;
  tenantName: string;
  rentAmount: number;
  leaseStartDate: string;
  leaseEndDate: string | null;
}

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { month } = await searchParams;
  const period = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);

  const rows = db
    .query<Row, [string]>(
      `SELECT p.id as propertyId, p.name as propertyName,
              u.id as unitId, u.unit_label as unitLabel,
              t.id as tenantId, t.name as tenantName,
              t.rent_amount as rentAmount, t.lease_start_date as leaseStartDate, t.lease_end_date as leaseEndDate
       FROM tenants t
       JOIN units u ON u.id = t.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE p.user_id = ?
       ORDER BY p.name, u.unit_label`,
    )
    .all(session.user.id);

  const relevantRows = rows.filter((r) => isLeaseActiveForPeriod(r.leaseStartDate, r.leaseEndDate, period));

  const paidByTenant = new Map<string, number>();
  if (relevantRows.length > 0) {
    const tenantIds = relevantRows.map((r) => r.tenantId);
    const placeholders = tenantIds.map(() => '?').join(',');
    const totals = db
      .query<{ tenant_id: string; total: number }, (string | number)[]>(
        `SELECT tenant_id, SUM(amount) as total FROM rent_payments
         WHERE period = ? AND tenant_id IN (${placeholders}) GROUP BY tenant_id`,
      )
      .all(period, ...tenantIds);
    for (const t of totals) paidByTenant.set(t.tenant_id, t.total);
  }

  return (
    <div className='p-8 max-w-5xl mx-auto'>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold'>Payments Overview</h1>
        <MonthPicker value={period} />
      </div>

      {relevantRows.length === 0 ? (
        <p className='text-foreground/60'>No active leases for this month.</p>
      ) : (
        <table className='w-full text-sm border-collapse'>
          <thead>
            <tr className='text-left border-b border-border'>
              <th className='py-2 pr-4'>Property</th>
              <th className='py-2 pr-4'>Unit</th>
              <th className='py-2 pr-4'>Tenant</th>
              <th className='py-2 pr-4'>Rent</th>
              <th className='py-2 pr-4'>Paid</th>
              <th className='py-2 pr-4'>Status</th>
            </tr>
          </thead>
          <tbody>
            {relevantRows.map((r) => {
              const paid = paidByTenant.get(r.tenantId) ?? 0;
              const status = computePaymentStatus(paid, r.rentAmount);
              return (
                <tr key={r.tenantId} className='border-b border-border/50'>
                  <td className='py-2 pr-4'>{r.propertyName}</td>
                  <td className='py-2 pr-4'>
                    <Link href={`/properties/${r.propertyId}/units/${r.unitId}`} className='text-blue-600 hover:underline'>
                      {r.unitLabel}
                    </Link>
                  </td>
                  <td className='py-2 pr-4'>{r.tenantName}</td>
                  <td className='py-2 pr-4'>{formatCents(r.rentAmount)}</td>
                  <td className='py-2 pr-4'>{formatCents(paid)}</td>
                  <td className='py-2 pr-4'>
                    <PaymentStatusBadge status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build and manually verify**

Run: `bun run build && bun dev`
In the browser: visit `/payments`, confirm it lists all active tenants across properties with correct status; change the month picker to a month before a lease started, confirm that tenant disappears from the list.

- [ ] **Step 4: Commit**

```bash
git add app/payments components/month-picker.tsx
git commit -m "feat: add cross-property monthly payments view"
```

---

## Task 8: Rebrand and final cleanup

**Files:**

- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/header.tsx`

**Interfaces:**

- Consumes: nothing new — pure copy/branding changes.

- [ ] **Step 1: Rewrite `app/page.tsx`**

```typescript
import Link from 'next/link';

export default function Home() {
  return (
    <div className='flex min-h-screen items-center justify-center p-8'>
      <main className='max-w-md text-center'>
        <h1 className='text-4xl font-bold mb-4'>8turf Apartments</h1>
        <p className='text-foreground/60 mb-8'>
          Track your properties, units, tenants, and rent payments in one place.
        </p>
        <Link
          href='/authenticate'
          className='inline-block px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800'
        >
          Log in
        </Link>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/layout.tsx` metadata**

Replace the `metadata` export:

```typescript
export const metadata: Metadata = {
  title: '8turf Apartments',
  description: 'Manage rental properties, units, tenants, and payments',
};
```

- [ ] **Step 3: Update `components/header.tsx`**

Replace `NextNotes` with `8turf Apartments`, and point the logo link at `/dashboard`:

```typescript
      <Link href='/dashboard' className='text-xl font-bold'>
        8turf Apartments
      </Link>
```

- [ ] **Step 4: Build and smoke-test**

Run: `bun run build && bun dev`
In the browser: visit `/`, confirm the new copy; log in, confirm the header says "8turf Apartments" and links to `/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/layout.tsx components/header.tsx
git commit -m "chore: rebrand app copy from NextNotes to 8turf Apartments"
```

---

## Task 9: Full test pass and cross-user authorization verification

**Files:**

- No new files — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `bun run test:run`
Expected: PASS — `lib/validation.test.ts`, `lib/payment-status.test.ts`, `lib/money.test.ts`, `lib/generate-password.test.ts` all green, no references to deleted note/TipTap modules remain anywhere (`grep -rn "notes\|tiptap\|isomorphic-dompurify" app lib components --include="*.ts*" -i` should return nothing outside of this plan/SPEC.MD).

- [ ] **Step 2: Run the linter**

Run: `bun run lint`
Expected: no errors.

- [ ] **Step 3: Manually verify cross-landlord isolation**

Using `bun run create-admin`, create two admin-managed user accounts (A and B) via `/admin/users` (or two `create-admin` runs). As user A, create a property/unit/tenant/payment, and note their IDs (visible in the URL). As user B, attempt to open `/properties/<A's property id>` and `/properties/<A's property id>/units/<A's unit id>` directly — expect a 404 (not a redirect, not the data). Confirm `/payments` for user B never lists user A's rows.

- [ ] **Step 4: Manually verify archive-vs-delete rules**

As any user: attempt to delete a property that still has units — expect the friendly error from `deleteProperty`. Attempt to delete a unit that has ever had a tenant — expect the friendly error from `deleteUnit`. Archive the property/unit instead and confirm both disappear from their respective list views but remain reachable at their direct detail URLs (SPEC.MD only requires them hidden from default views, not made unreachable — no additional guard needed beyond the `archived_at IS NULL` filters already used in list queries).

- [ ] **Step 5: Commit (only if any fixes were needed in the steps above)**

```bash
git add -A
git commit -m "fix: address issues found in cross-user authorization verification"
```
