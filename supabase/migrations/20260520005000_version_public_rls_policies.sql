-- Version the public RLS baseline used by the app.
-- Browser clients may read public list/profile data, but all writes are routed
-- through Edge Functions that verify LINE identity and roles with the service role.

alter table public.activities enable row level security;
alter table public.registrations enable row level security;
alter table public.members enable row level security;

grant usage on schema public to anon, authenticated;

grant select on table public.activities to anon, authenticated;
grant select on table public.registrations to anon, authenticated;
grant select on table public.members to anon, authenticated;

revoke insert, update, delete on table public.activities from anon, authenticated;
revoke insert, update, delete on table public.registrations from anon, authenticated;
revoke insert, update, delete on table public.members from anon, authenticated;

drop policy if exists "public read activities" on public.activities;
create policy "public read activities"
on public.activities
for select
to anon, authenticated
using (true);

drop policy if exists "public read registrations" on public.registrations;
create policy "public read registrations"
on public.registrations
for select
to anon, authenticated
using (true);

drop policy if exists "public read members" on public.members;
create policy "public read members"
on public.members
for select
to anon, authenticated
using (true);
