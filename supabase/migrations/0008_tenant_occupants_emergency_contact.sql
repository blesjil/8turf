-- Add other occupants (list of names) and an emergency contact to tenants.
alter table tenants
  add column occupants jsonb not null default '[]'::jsonb,
  add column emergency_contact_name text,
  add column emergency_contact_phone text;
