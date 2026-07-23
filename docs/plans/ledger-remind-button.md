# Payment Ledger: "Send SMS" → "Remind" (email + SMS)

## Context

The Payment Ledger currently has a per-entry "Send SMS" button that sends a payment-received SMS once (tracked via `rent_payments.sms_sent_at`). Separately, a receipt **email** is auto-sent (fire-and-forget, untracked) when a payment is recorded. The Payments Overview already has a "Remind" button that sends both email + SMS.

Goal: replace the ledger's "Send SMS" button with a **"Remind"** button that manually sends **both** the receipt email and receipt SMS, styled like the overview's Remind button (`variant='outline' size='xs'`). Decisions confirmed with user:

- **Remove** the auto-email on `recordPayment` (single, tracked send path).
- Keep **once-only** semantics (disabled "Sent" state after sending; no re-send dialog).

## Plan

### 1. DB migration — rename tracking column

New migration `supabase/migrations/20260724XXXXXX_rename_sms_sent_at_to_receipt_sent_at.sql`:

```sql
ALTER TABLE rent_payments RENAME COLUMN sms_sent_at TO receipt_sent_at;
```

Existing timestamps remain valid history. Apply locally (`supabase migration up` / `supabase db reset` — local DB on port 54342).

### 2. Server action — send both channels

`app/properties/[id]/units/[unitId]/actions.ts`:

- Rename `sendPaymentSms` → `sendPaymentReceiptNotice` (avoid name clash with `sendPaymentReceipt` from `lib/mail.ts`).
- `findAuthorizedPayment` (lines ~377–401): also select `t.email AS tenant_email`; select `receipt_sent_at` instead of `sms_sent_at`.
- New flow (mirror `sendReminder` in `app/payments/actions.ts:45-98`):
  - Guard: `receipt_sent_at` set → "Receipt already sent."
  - Guard: no email AND no phone → "Tenant has no email or phone."
  - If email: `sendPaymentReceipt(email, {...})` from `lib/mail.ts` (already exists, lines 42–94) — try/catch independently.
  - If phone: `sendSmsPaymentReceipt(phone, {...})` from `lib/sms.ts` — try/catch independently.
  - If at least one succeeded → `UPDATE rent_payments SET receipt_sent_at = now() WHERE id = $1`, then redirect back.
  - If none succeeded → return `{ error: { general: ... } }` (e.g. "Failed to send receipt." / "Email and SMS are not configured.").
- **Remove auto-email** in `recordPayment` (lines ~355–372, the fire-and-forget `sendPaymentReceipt` call after insert).

### 3. Component — Remind button

`components/payment-ledger.tsx`:

- `Payment` interface: `sms_sent_at` → `receipt_sent_at`.
- Rename `SendSmsButton` → `RemindButton`; props `hasPhone` → `hasPhone` + `hasEmail` (or a single `hasContact`).
- Button format matches `components/send-reminder-button.tsx:75-77`: `variant='outline' size='xs'`, label `Remind` / `Sending…`.
- States:
  - `receipt_sent_at` set → disabled `outline`/`xs` button labeled "Sent" (or status text `text-xs text-muted-foreground` like the overview).
  - No email and no phone → disabled button, `title='No email or phone on file'`.
  - Otherwise → active form submit, error shown as `text-xs text-destructive`.

### 4. Callers & queries

- `app/properties/[id]/units/[unitId]/page.tsx` (~line 156): pass `hasEmail={Boolean(activeTenant.email)}` alongside `hasPhone`; also the past-tenancy `<PaymentLedger>` (~line 191) if it takes these props.
- Update the payments SELECT in that page (or wherever `Payment[]` is fetched) from `sms_sent_at` → `receipt_sent_at`.
- Grep for remaining `sms_sent_at` / `sendPaymentSms` references and update.

## Tasks

- [x] Migration renaming `sms_sent_at` → `receipt_sent_at` (`supabase/migrations/20260724000000_rename_sms_sent_at_to_receipt_sent_at.sql`) — applied locally
- [x] Rework action to `sendPaymentReceiptNotice` sending email + SMS; remove auto-email from `recordPayment` (`app/properties/[id]/units/[unitId]/actions.ts`); `sendPaymentReceipt` in `lib/mail.ts` now returns boolean
- [x] Rename/restyle button to "Remind" with outline/xs format and new states (`components/payment-ledger.tsx`)
- [x] Pass `hasEmail`, update payment query column (`app/properties/[id]/units/[unitId]/page.tsx`)
- [x] Lint + full vitest suite pass (287 tests); verified in browser — Remind sent real email + SMS, button flipped to "Sent", `receipt_sent_at` set in DB

## Verification

- `supabase migration up` locally, then `bun dev` (port 3001).
- Unit page ledger: button reads "Remind" (outline/xs, same look as Payments Overview).
- Tenant with email+phone → click Remind → both email and SMS attempted; button flips to "Sent"; `receipt_sent_at` set in DB.
- Tenant with neither → disabled with tooltip.
- Record a new payment → no auto-email sent.
- `bun run lint` passes; run existing tests (`__tests__/lib/mail.test.ts`, `__tests__/lib/sms.test.ts`) — should be unaffected.
