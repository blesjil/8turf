-- Reminders can now go out by email, SMS (Semaphore), or both; record which
-- channel(s) actually succeeded so the UI can show how a tenant was reminded.
alter table payment_reminders
  add column channel text not null default 'email'
  check (channel in ('email', 'sms', 'both'));
