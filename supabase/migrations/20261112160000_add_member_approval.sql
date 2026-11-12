-- Existing members retain access. Accounts created after this migration await review.
alter table public.members add column approved_at timestamptz;

update public.members set approved_at = now();
