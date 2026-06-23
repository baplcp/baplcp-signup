alter table registrations
  add column if not exists leave_times jsonb default '{}'::jsonb;
