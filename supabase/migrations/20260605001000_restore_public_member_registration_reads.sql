-- Restore the original public read model on base tables after removing the
-- narrow public registration/member views.

drop view if exists public.public_member_genders;
drop view if exists public.public_registrations;

grant select on table public.registrations to anon, authenticated;
grant select on table public.members to anon, authenticated;

drop policy if exists "public observe registrations" on public.registrations;
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
