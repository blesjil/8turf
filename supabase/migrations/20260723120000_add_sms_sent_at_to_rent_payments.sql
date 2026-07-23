-- Manual, once-only payment-received SMS per ledger entry.
-- A nullable timestamp doubles as the "already sent" guard (IS NOT NULL) and an
-- audit trail. No default/backfill: existing payments stay unsent.
ALTER TABLE rent_payments ADD COLUMN sms_sent_at timestamptz;
