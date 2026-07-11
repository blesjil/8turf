alter table tenants add column deposit_amount integer;

-- Existing tenants paid a deposit equal to their monthly rent by convention.
update tenants set deposit_amount = rent_amount;

alter table tenants
  alter column deposit_amount set not null;

alter table tenants
  add constraint tenants_deposit_amount_check check (deposit_amount >= 0);
