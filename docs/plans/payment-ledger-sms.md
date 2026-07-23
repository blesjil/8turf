# Payment Ledger SMS Receipt

## Context

Recording a payment already emails the tenant a receipt. This adds a **manual,
per-ledger-entry, once-only** SMS "payment received" confirmation the owner can
send from the ledger table. Message stays under 130 chars (one GSM-7 segment).
The "sent once" guard lives on the ledger row (`rent_payments.sms_sent_at`).

Confirmed decisions: payment-received receipt wording; one-click send (no confirm
dialog); button flips to a disabled "SMS sent" state after sending.

## Plan / Tasks

- [x] Migration `supabase/migrations/20260723120000_add_sms_sent_at_to_rent_payments.sql` —
      add nullable `sms_sent_at timestamptz` to `rent_payments`.
- [x] `lib/sms.ts` — extract shared `postSemaphoreMessage(phone, message)` +
      `firstNameForSms`; add `sendSmsPaymentReceipt(phone, details)` (returns
      false when unconfigured). Message: `Hi {first}, we received your {Php amount}
payment for {Mon D}-{Mon D}. Thank you! -8TURF Apartments`.
- [x] `app/properties/[id]/units/[unitId]/actions.ts` — extend
      `findAuthorizedPayment` to return name/phone/amount/period/sms_sent_at; add
      `sendPaymentSms(_prev, formData)` server action (idempotent via
      `sms_sent_at`; validates phone + config; stamps `sms_sent_at = now()`;
      redirects on success).
- [x] `page.tsx` — add `sms_sent_at` to the ledger SELECT; `payment-ledger.tsx`
      `Payment` type gains `sms_sent_at: string | null`.
- [x] `payment-ledger.tsx` — `SendSmsButton` in the `!readOnly` actions cell;
      disabled "SMS sent" once sent, inline error text on failure.
- [x] `__tests__/lib/sms.test.ts` — receipt length/content/unconfigured tests.

## Verification

- `supabase migration up` applies cleanly.
- `bun test __tests__/lib/sms.test.ts` and `bun run lint` pass.
- Manual: send from an active ledger row → button becomes "SMS sent"; persists on
  reload; second send blocked; read-only ledgers have no button; no-phone tenant
  shows inline error.
