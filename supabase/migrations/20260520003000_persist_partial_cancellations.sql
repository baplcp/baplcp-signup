-- Persist member-level cancellations that do not cancel the whole registration row.

alter table public.registrations
add column if not exists cancelled_members jsonb not null default '[]'::jsonb;
