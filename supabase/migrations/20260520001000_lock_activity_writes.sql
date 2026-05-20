-- Activity writes now go through Edge Functions that verify LINE identity
-- and organizer role before using the service role key.

revoke insert, update, delete on table public.activities from anon, authenticated;

grant select on table public.activities to anon, authenticated;
