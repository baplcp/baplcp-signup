-- User-owned writes now go through Edge Functions that verify the LINE access token.
-- Keep public reads for the existing list screens, but prevent direct PostgREST writes
-- with the anon key from forging LINE user_id/display_name values.

revoke insert, update, delete on table public.registrations from anon, authenticated;
revoke insert, update, delete on table public.members from anon, authenticated;

grant select on table public.registrations to anon, authenticated;
grant select on table public.members to anon, authenticated;
