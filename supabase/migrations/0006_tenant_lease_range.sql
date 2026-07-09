-- Enforce lease_end_date >= lease_start_date at the DB level, matching the
-- existing rent_payments_period_range constraint. The app-level zod schema
-- validates this too, but nothing previously stopped a bad row.

alter table tenants
  add constraint tenants_lease_range
    check (lease_end_date is null or lease_end_date >= lease_start_date);
