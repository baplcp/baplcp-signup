-- Restrict browser reads on sensitive base tables and expose only the
-- columns the public app needs through narrow views.

create or replace view public.public_registrations as
select
  registration.id,
  registration.activity_id,
  registration.activity_date,
  registration.user_id,
  registration.display_name,
  registration.picture_url,
  registration.self_count,
  registration.self_added_at,
  registration.guest_count,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'name', guest ->> 'name',
          'gender', guest ->> 'gender',
          'added_at', guest ->> 'added_at'
        )
      )
      from jsonb_array_elements(coalesce(registration.guests::jsonb, '[]'::jsonb)) as guest
    ),
    '[]'::jsonb
  ) as guests,
  registration.status,
  registration.leave_dates,
  registration.rejoin_times,
  registration.cancelled_members,
  registration.created_at
from public.registrations as registration;

create or replace view public.public_member_genders as
select distinct
  member.user_id,
  member.gender
from public.members as member
join public.registrations as registration
  on registration.user_id = member.user_id;

revoke select on table public.registrations from anon, authenticated;
revoke select on table public.members from anon, authenticated;

-- Keep a minimal observable registration surface so realtime changes can
-- still wake the client, while full list reads go through public_registrations.
grant select (id, activity_id, activity_date, status) on table public.registrations to anon, authenticated;

grant select on table public.public_registrations to anon, authenticated;
grant select on table public.public_member_genders to anon, authenticated;

drop policy if exists "public read registrations" on public.registrations;
create policy "public observe registrations"
on public.registrations
for select
to anon, authenticated
using (true);

drop policy if exists "public read members" on public.members;
