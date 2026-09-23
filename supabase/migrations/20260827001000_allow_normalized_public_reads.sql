-- The browser previously read the equivalent data from public.activities and
-- public.registrations. Keep that read model while the application moves to
-- normalized tables. Writes remain service-role only through Edge Functions.

grant select on table public.activity_dates to anon, authenticated;
grant select on table public.registration_guests to anon, authenticated;
grant select on table public.season_registration_date_statuses to anon, authenticated;
grant select on table public.registration_cancellation_events to anon, authenticated;

drop policy if exists "public read activity dates" on public.activity_dates;
create policy "public read activity dates"
on public.activity_dates
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.activities
    where activities.id = activity_dates.activity_id
  )
);

drop policy if exists "public read registration guests" on public.registration_guests;
create policy "public read registration guests"
on public.registration_guests
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.registrations
    where registrations.id = registration_guests.registration_id
  )
);

drop policy if exists "public read season registration date statuses" on public.season_registration_date_statuses;
create policy "public read season registration date statuses"
on public.season_registration_date_statuses
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.registrations
    where registrations.id = season_registration_date_statuses.registration_id
  )
);

drop policy if exists "public read registration cancellation events" on public.registration_cancellation_events;
create policy "public read registration cancellation events"
on public.registration_cancellation_events
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.registrations
    where registrations.id = registration_cancellation_events.registration_id
  )
);
