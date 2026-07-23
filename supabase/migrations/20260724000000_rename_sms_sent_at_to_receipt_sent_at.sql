-- The manual ledger send now covers email + SMS, so the once-only tracking
-- column is renamed to be channel-agnostic. Existing timestamps stay valid.
ALTER TABLE rent_payments RENAME COLUMN sms_sent_at TO receipt_sent_at;
