-- ---------------------------------------------------------------------------
-- rent_payments: period becomes a stay date range (period_start / period_end).
-- The YYYY-MM period column stays, derived from period_start, so monthly
-- reporting keeps working unchanged.
-- ---------------------------------------------------------------------------

alter table rent_payments
  add column period_start text,
  add column period_end text;

update rent_payments
set
  period_start = period || '-01',
  period_end = to_char((period || '-01')::date + 30, 'YYYY-MM-DD');

alter table rent_payments
  alter column period_start set not null,
  alter column period_end set not null,
  add constraint rent_payments_period_start_format
    check (period_start ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  add constraint rent_payments_period_end_format
    check (period_end ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  add constraint rent_payments_period_range
    check (period_end >= period_start);
