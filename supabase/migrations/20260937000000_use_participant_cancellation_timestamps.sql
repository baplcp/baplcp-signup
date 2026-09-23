-- Cancellations belong to participants, not to a mutable registration status
-- or a reconstructed snapshot collection.  A new registration/guest row is
-- created when a previously cancelled participant joins again.

alter table public.registrations
  add column if not exists cancelled_at timestamptz;

alter table public.registration_guests
  add column if not exists invited_by uuid,
  add column if not exists cancelled_at timestamptz;

-- The previous model did not persist an exact cancellation time.  Preserve
-- its only durable timestamp rather than inventing one from joined_at.
update public.registrations
set cancelled_at = created_at
where status = 'cancelled'
  and cancelled_at is null;

update public.registration_guests as guest
set invited_by = registration.member_id
from public.registrations as registration
where registration.id = guest.registration_id
  and guest.invited_by is null;

-- Historical cancelled guests may reuse the same display position as a live
-- guest, so remove the old all-rows uniqueness before backfilling them.
alter table public.registration_guests drop constraint if exists registration_guests_position_unique;

-- Convert historical guest snapshots to cancelled guest rows before removing
-- the old table.  Their recorded_at was not a cancellation timestamp, so the
-- event creation time is retained as the best available historical value.
insert into public.registration_guests (
  registration_id, guest_position, display_name, gender, joined_at,
  paid_court, paid_ac, invited_by, cancelled_at
)
select
  event.registration_id,
  event.position,
  event.guest_display_name,
  null,
  event.participant_added_at,
  false,
  false,
  event.member_id,
  event.created_at
from public.registration_cancellation_events as event
where event.participant_type = 'guest';

-- A partial cancellation used to set self_count to zero and write a snapshot.
-- Restore the historical participant count and attach the cancellation time to
-- the registration itself.
update public.registrations as registration
set self_count = greatest(coalesce(registration.self_count, 0), 1),
    cancelled_at = coalesce(registration.cancelled_at, event.created_at, registration.created_at)
from public.registration_cancellation_events as event
where event.registration_id = registration.id
  and event.participant_type = 'self';

alter table public.registration_guests
  alter column invited_by set not null;

alter table public.registration_guests
  add constraint registration_guests_invited_by_fkey
  foreign key (invited_by) references public.members(id) on delete restrict;

drop trigger if exists registration_guests_sync_guest_count on public.registration_guests;
drop trigger if exists registrations_enforce_capacity on public.registrations;
drop trigger if exists registrations_sync_member_season_status on public.registrations;

drop index if exists public.registrations_active_pickup_activity_date_member_unique;
drop index if exists public.registrations_active_season_member_unique;
drop index if exists public.registrations_activity_date_status_created_idx;
create unique index registrations_active_pickup_member_unique
  on public.registrations (activity_id, activity_date_id, member_id)
  where cancelled_at is null and activity_date_id is not null;

create unique index registrations_active_season_member_unique
  on public.registrations (activity_id, member_id)
  where cancelled_at is null and activity_date_id is null;

create unique index registration_guests_active_position_unique
  on public.registration_guests (registration_id, guest_position)
  where cancelled_at is null;

create index registration_guests_invited_by_active_idx
  on public.registration_guests (invited_by, cancelled_at);

create index registrations_activity_date_cancelled_created_idx
  on public.registrations (activity_id, activity_date_id, cancelled_at, created_at);

create or replace function public.sync_member_season_status_from_registrations()
returns trigger
language plpgsql
as $$
declare
  affected_member_ids uuid[] := array[]::uuid[];
begin
  if tg_op in ('UPDATE', 'DELETE') and old.activity_date_id is null then
    affected_member_ids := array_append(affected_member_ids, old.member_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.activity_date_id is null then
    affected_member_ids := array_append(affected_member_ids, new.member_id);
  end if;

  update public.members as member
  set is_season = exists (
    select 1 from public.registrations as registration
    where registration.member_id = member.id
      and registration.activity_date_id is null
      and registration.cancelled_at is null
  )
  where member.id = any(affected_member_ids);
  return null;
end;
$$;

create trigger registrations_sync_member_season_status
after insert or update of member_id, activity_date_id, cancelled_at or delete on public.registrations
for each row execute function public.sync_member_season_status_from_registrations();

create or replace function public.write_registration_v3(
  p_registration_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target_registration_id uuid;
  target_activity_id bigint;
  target_activity_date_id bigint;
  target_member_id uuid;
  invitation_limit integer;
  active_guest_total integer;
  capacity integer;
  occupied_total integer;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;
  if p_payload ? 'guests' and jsonb_typeof(p_payload -> 'guests') <> 'array' then
    raise exception 'invalid_guests' using errcode = '22023';
  end if;

  if p_registration_id is null then
    target_activity_id := (p_payload ->> 'activity_id')::bigint;
    target_activity_date_id := nullif(p_payload ->> 'activity_date_id', '')::bigint;
    target_member_id := nullif(p_payload ->> 'member_id', '')::uuid;
  else
    select registration.activity_id, registration.activity_date_id, registration.member_id
      into target_activity_id, target_activity_date_id, target_member_id
      from public.registrations as registration
      where registration.id = p_registration_id;
    if target_activity_id is null then
      raise exception 'registration_not_found' using errcode = 'P0002';
    end if;
  end if;

  if target_activity_id is null or target_member_id is null then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;
  if target_activity_date_id is not null and not exists (
    select 1 from public.activity_dates as activity_date
    where activity_date.id = target_activity_date_id and activity_date.activity_id = target_activity_id
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  -- Serialise mutations for an activity so guest invitation and capacity
  -- checks remain correct under concurrent requests.
  perform 1 from public.activities where id = target_activity_id for update;

  if p_registration_id is null then
    insert into public.registrations (
      activity_id, activity_date_id, member_id, self_count, self_added_at,
      paid_court, paid_ac, season_plan, cancelled_at
    ) values (
      target_activity_id, target_activity_date_id, target_member_id,
      coalesce((p_payload ->> 'self_count')::integer, 0),
      public.normalization_safe_timestamptz(p_payload ->> 'self_added_at'),
      coalesce((p_payload ->> 'paid_court')::boolean, false),
      coalesce((p_payload ->> 'paid_ac')::boolean, false),
      coalesce(p_payload ->> 'season_plan', 'quarter'),
      public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at')
    ) returning id into target_registration_id;
  else
    update public.registrations as registration
    set self_count = case when p_payload ? 'self_count' then (p_payload ->> 'self_count')::integer else registration.self_count end,
        self_added_at = case when p_payload ? 'self_added_at' then public.normalization_safe_timestamptz(p_payload ->> 'self_added_at') else registration.self_added_at end,
        cancelled_at = case when p_payload ? 'cancelled_at' then public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at') else registration.cancelled_at end,
        paid_court = case when p_payload ? 'paid_court' then (p_payload ->> 'paid_court')::boolean else registration.paid_court end,
        paid_ac = case when p_payload ? 'paid_ac' then (p_payload ->> 'paid_ac')::boolean else registration.paid_ac end,
        season_plan = case when p_payload ? 'season_plan' then p_payload ->> 'season_plan' else registration.season_plan end
    where registration.id = p_registration_id
    returning registration.id into target_registration_id;
  end if;

  if p_payload ? 'guests' then
    update public.registration_guests as guest
    set cancelled_at = now(), updated_at = now()
    where guest.registration_id = target_registration_id
      and guest.cancelled_at is null
      and not exists (
        select 1 from jsonb_array_elements(p_payload -> 'guests') as item(value)
        where nullif(item.value ->> 'id', '')::uuid = guest.id
      );

    update public.registration_guests as guest
    set guest_position = item.ordinality::integer - 1,
        display_name = nullif(btrim(item.value ->> 'name'), ''),
        gender = case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end,
        paid_court = case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end,
        paid_ac = case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end,
        updated_at = now()
    from jsonb_array_elements(p_payload -> 'guests') with ordinality as item(value, ordinality)
    where guest.registration_id = target_registration_id
      and guest.cancelled_at is null
      and guest.id = nullif(item.value ->> 'id', '')::uuid;

    insert into public.registration_guests (
      registration_id, guest_position, display_name, gender, joined_at,
      paid_court, paid_ac, invited_by
    )
    select target_registration_id, item.ordinality::integer - 1,
      nullif(btrim(item.value ->> 'name'), ''),
      case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end,
      coalesce(public.normalization_safe_timestamptz(item.value ->> 'added_at'), now()),
      case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end,
      case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end,
      target_member_id
    from jsonb_array_elements(p_payload -> 'guests') with ordinality as item(value, ordinality)
    where nullif(item.value ->> 'id', '') is null;
  end if;

  invitation_limit := nullif(p_payload ->> 'invitation_limit', '')::integer;
  if invitation_limit is not null and target_activity_date_id is not null then
    select count(*)::integer into active_guest_total
    from public.registration_guests as guest
    join public.registrations as registration on registration.id = guest.registration_id
    where guest.invited_by = target_member_id
      and guest.cancelled_at is null
      and registration.activity_date_id = target_activity_date_id;
    if active_guest_total > invitation_limit then
      raise exception 'guest_invitation_limit_exceeded' using errcode = 'P0001';
    end if;
  end if;

  if target_activity_date_id is null then
    select case
      when nullif(btrim(activity.season_capacity::text), '') is null then null
      when lower(activity.season_capacity::text) = 'unlimited' then null
      when activity.season_capacity::text ~ '^\d+$' then activity.season_capacity::integer
      else null
    end into capacity
    from public.activities as activity where activity.id = target_activity_id;

    if capacity is not null and capacity > 0 then
      select coalesce(sum(registration.self_count), 0)::integer into occupied_total
      from public.registrations as registration
      where registration.activity_id = target_activity_id
        and registration.activity_date_id is null
        and registration.cancelled_at is null;
      if occupied_total > capacity then
        raise exception 'season_capacity_exceeded' using errcode = 'P0001';
      end if;
    end if;
  else
    select activity.single_capacity into capacity
    from public.activities as activity where activity.id = target_activity_id;
    if capacity is not null and capacity > 0 then
      select
        coalesce((select sum(registration.self_count) from public.registrations as registration where registration.activity_date_id = target_activity_date_id and registration.cancelled_at is null), 0)
        + coalesce((select count(*) from public.registration_guests as guest join public.registrations as registration on registration.id = guest.registration_id where registration.activity_date_id = target_activity_date_id and guest.cancelled_at is null), 0)
        + coalesce((select sum(registration.self_count) from public.registrations as registration left join public.season_registration_date_statuses as date_status on date_status.registration_id = registration.id and date_status.activity_date_id = target_activity_date_id where registration.activity_id = target_activity_id and registration.activity_date_id is null and registration.cancelled_at is null and not coalesce(date_status.is_on_leave, false)), 0)
      into occupied_total;
      if occupied_total > capacity then
        raise exception 'single_capacity_exceeded' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return target_registration_id;
end;
$$;

-- The read model returns participant rows with their own cancellation times.
create or replace function public.get_activity_registration(p_registration_id uuid)
returns jsonb language sql stable security invoker as $$
  select jsonb_build_object(
    'id', registration.id, 'activity_id', registration.activity_id,
    'activity_date_id', registration.activity_date_id,
    'activity_date', activity_date.activity_date,
    'user_id', member.user_id, 'display_name', member.display_name,
    'picture_url', member.picture_url, 'self_count', registration.self_count,
    'guest_count', (select count(*) from public.registration_guests as guest where guest.registration_id = registration.id and guest.cancelled_at is null),
    'cancelled_at', registration.cancelled_at, 'created_at', registration.created_at,
    'self_added_at', registration.self_added_at, 'paid_court', registration.paid_court,
    'paid_ac', registration.paid_ac, 'season_plan', registration.season_plan,
    'member_gender', member.gender,
    'guests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', guest.id, 'name', guest.display_name, 'gender', guest.gender,
      'added_at', guest.joined_at, 'cancelled_at', guest.cancelled_at,
      'paid_court', guest.paid_court, 'paid_ac', guest.paid_ac,
      'invited_by', guest.invited_by) order by guest.guest_position)
      from public.registration_guests as guest where guest.registration_id = registration.id), '[]'::jsonb),
    'leave_dates', coalesce((select jsonb_agg(date_row.activity_date order by date_row.activity_date)
      from public.season_registration_date_statuses as date_status join public.activity_dates as date_row on date_row.id = date_status.activity_date_id
      where date_status.registration_id = registration.id and date_status.is_on_leave), '[]'::jsonb),
    'leave_times', coalesce((select jsonb_object_agg(date_row.activity_date::text, date_status.leave_submitted_at)
      from public.season_registration_date_statuses as date_status join public.activity_dates as date_row on date_row.id = date_status.activity_date_id
      where date_status.registration_id = registration.id and date_status.leave_submitted_at is not null), '{}'::jsonb),
    'rejoin_times', coalesce((select jsonb_object_agg(date_row.activity_date::text, date_status.rejoined_at)
      from public.season_registration_date_statuses as date_status join public.activity_dates as date_row on date_row.id = date_status.activity_date_id
      where date_status.registration_id = registration.id and date_status.rejoined_at is not null), '{}'::jsonb)
  )
  from public.registrations as registration
  join public.members as member on member.id = registration.member_id
  left join public.activity_dates as activity_date on activity_date.id = registration.activity_date_id
  where registration.id = p_registration_id;
$$;

create or replace function public.get_activity_page(
  p_activity_id bigint default null,
  p_activity_date_id bigint default null
)
returns jsonb language sql stable security invoker as $$
  with target_activity as (
    select activity.* from public.activities as activity
    where p_activity_id is null or activity.id = p_activity_id
    order by activity.created_at desc limit 1
  ), activity_dates as (
    select date_row.id, date_row.activity_date, date_row.sort_order
    from public.activity_dates as date_row join target_activity as activity on activity.id = date_row.activity_id
    where date_row.is_active
  ), selected_date as (
    select date_row.id, date_row.activity_date from activity_dates as date_row
    order by case when date_row.id = p_activity_date_id then 0 else 1 end,
      case when date_row.activity_date >= (now() at time zone 'Asia/Taipei')::date then 0 else 1 end,
      case when date_row.activity_date >= (now() at time zone 'Asia/Taipei')::date then date_row.activity_date end asc,
      case when date_row.activity_date < (now() at time zone 'Asia/Taipei')::date then date_row.activity_date end desc
    limit 1
  ), registration_payloads as (
    select registration.activity_date_id, registration.created_at,
      public.get_activity_registration(registration.id) as payload
    from public.registrations as registration
    join target_activity as activity on activity.id = registration.activity_id
    left join selected_date on true
    where registration.activity_date_id is null or registration.activity_date_id = selected_date.id
  )
  select jsonb_build_object(
    'activity', to_jsonb(activity) || jsonb_build_object(
      'dates', coalesce((select jsonb_agg(date_row.activity_date order by date_row.sort_order) from activity_dates as date_row), '[]'::jsonb),
      'activity_dates', coalesce((select jsonb_agg(jsonb_build_object('id', date_row.id, 'activity_date', date_row.activity_date) order by date_row.sort_order) from activity_dates as date_row), '[]'::jsonb),
      'selected_activity_date_id', selected_date.id,
      'selected_activity_date', selected_date.activity_date
    ),
    'pickup_registrations', coalesce((select jsonb_agg(payload order by created_at) from registration_payloads where activity_date_id is not null), '[]'::jsonb),
    'season_registrations', coalesce((select jsonb_agg(payload order by created_at) from registration_payloads where activity_date_id is null), '[]'::jsonb)
  )
  from target_activity as activity left join selected_date on true;
$$;

create or replace function public.count_past_participations(
  p_user_id text, p_start_date date, p_end_date date
)
returns bigint language sql stable security invoker as $$
  with taiwan_now as (select timezone('Asia/Taipei', now()) as value),
  target_member as (select id from public.members where user_id = p_user_id),
  pickup_count as (
    select count(*) as value from public.registrations as registration
    join target_member as member on member.id = registration.member_id
    join public.activity_dates as activity_date on activity_date.id = registration.activity_date_id
    join public.activities as activity on activity.id = registration.activity_id cross join taiwan_now
    where registration.cancelled_at is null and registration.self_count > 0
      and activity_date.activity_date >= p_start_date
      and (activity_date.activity_date < p_end_date or (activity_date.activity_date = p_end_date and activity.end_time is not null and taiwan_now.value::time > activity.end_time))
  ), season_count as (
    select count(*) as value from public.registrations as registration
    join target_member as member on member.id = registration.member_id
    join public.activities as activity on activity.id = registration.activity_id
    join lateral (select (date_trunc('month', min(activity_date.activity_date)) + interval '3 months')::date as quarter_cutoff from public.activity_dates as activity_date where activity_date.activity_id = registration.activity_id) as activity_period on true
    join public.activity_dates as activity_date on activity_date.activity_id = registration.activity_id
    left join public.season_registration_date_statuses as date_status on date_status.registration_id = registration.id and date_status.activity_date_id = activity_date.id cross join taiwan_now
    where registration.cancelled_at is null and registration.self_count > 0 and registration.activity_date_id is null
      and activity_date.activity_date >= p_start_date
      and (activity_date.activity_date < p_end_date or (activity_date.activity_date = p_end_date and activity.end_time is not null and taiwan_now.value::time > activity.end_time))
      and (registration.season_plan = 'half-year' or (coalesce(registration.season_plan, 'quarter') = 'quarter' and activity_date.activity_date < activity_period.quarter_cutoff))
      and not coalesce(date_status.is_on_leave, false)
  ) select pickup_count.value + season_count.value from pickup_count cross join season_count;
$$;

drop function if exists public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint);
create function public.list_group_activity_sessions(
  p_segment text, p_limit integer, p_now timestamptz,
  p_cursor_activity_date date default null, p_cursor_created_at timestamptz default null,
  p_cursor_activity_date_id bigint default null
)
returns table (
  activity_id bigint, activity_date date, title text, location text, start_time text,
  end_time text, single_capacity integer, occupied_count integer,
  activity_created_at timestamptz, activity_date_id bigint
)
language sql stable security invoker as $$
  with local_time as (select (p_now at time zone 'Asia/Taipei')::date as today),
  requested_dates as (
    select date_row.id, date_row.activity_id, date_row.activity_date, activity.title, activity.location,
      activity.start_time, activity.end_time, activity.single_capacity, activity.created_at
    from public.activity_dates as date_row join public.activities as activity on activity.id = date_row.activity_id cross join local_time
    where date_row.is_active and (
      (p_segment = 'upcoming' and (date_row.activity_date > local_time.today or (date_row.activity_date = local_time.today and (activity.end_time is null or ((date_row.activity_date + activity.end_time + interval '1 hour') at time zone 'Asia/Taipei') >= p_now))))
      or (p_segment = 'ended' and (date_row.activity_date < local_time.today or (date_row.activity_date = local_time.today and activity.end_time is not null and ((date_row.activity_date + activity.end_time + interval '1 hour') at time zone 'Asia/Taipei') < p_now)))
    ) and (
      p_cursor_activity_date is null
      or (
        p_segment = 'upcoming' and (
          date_row.activity_date > p_cursor_activity_date
          or (date_row.activity_date = p_cursor_activity_date and (activity.created_at < p_cursor_created_at or (activity.created_at = p_cursor_created_at and date_row.id > p_cursor_activity_date_id)))
        )
      )
      or (
        p_segment = 'ended' and (
          date_row.activity_date < p_cursor_activity_date
          or (date_row.activity_date = p_cursor_activity_date and (activity.created_at < p_cursor_created_at or (activity.created_at = p_cursor_created_at and date_row.id > p_cursor_activity_date_id)))
        )
      )
    )
    order by case when p_segment = 'upcoming' then date_row.activity_date end asc, case when p_segment = 'ended' then date_row.activity_date end desc, activity.created_at desc, date_row.id
    limit least(greatest(coalesce(p_limit, 0), 0), 50)
  ), pickup_people as (
    select registration.activity_date_id, sum(registration.self_count)::integer as self_count
    from public.registrations as registration join requested_dates on requested_dates.id = registration.activity_date_id
    where registration.cancelled_at is null group by registration.activity_date_id
  ), guest_people as (
    select registration.activity_date_id, count(*)::integer as guest_count
    from public.registration_guests as guest join public.registrations as registration on registration.id = guest.registration_id
    join requested_dates on requested_dates.id = registration.activity_date_id where guest.cancelled_at is null group by registration.activity_date_id
  ), season_people as (
    select requested_dates.id as activity_date_id, coalesce(sum(case when date_status.is_on_leave then 0 else registration.self_count end), 0)::integer as self_count
    from requested_dates left join public.registrations as registration on registration.activity_id = requested_dates.activity_id and registration.activity_date_id is null and registration.cancelled_at is null
    left join public.season_registration_date_statuses as date_status on date_status.registration_id = registration.id and date_status.activity_date_id = requested_dates.id
    group by requested_dates.id
  ) select requested_dates.activity_id, requested_dates.activity_date, requested_dates.title, requested_dates.location,
    requested_dates.start_time::text, requested_dates.end_time::text, requested_dates.single_capacity,
    coalesce(pickup_people.self_count, 0) + coalesce(guest_people.guest_count, 0) + coalesce(season_people.self_count, 0),
    requested_dates.created_at, requested_dates.id
  from requested_dates left join pickup_people on pickup_people.activity_date_id = requested_dates.id
  left join guest_people on guest_people.activity_date_id = requested_dates.id
  left join season_people on season_people.activity_date_id = requested_dates.id
  order by case when p_segment = 'upcoming' then requested_dates.activity_date end asc, case when p_segment = 'ended' then requested_dates.activity_date end desc, requested_dates.created_at desc, requested_dates.id;
$$;

revoke all on function public.get_activity_page(bigint, bigint) from public;
grant execute on function public.get_activity_page(bigint, bigint) to anon, authenticated, service_role;
revoke all on function public.get_activity_registration(uuid) from public;
grant execute on function public.get_activity_registration(uuid) to anon, authenticated, service_role;
revoke all on function public.write_registration_v3(uuid, jsonb) from public;
grant execute on function public.write_registration_v3(uuid, jsonb) to service_role;
revoke all on function public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint) from public;
grant execute on function public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint) to anon, authenticated, service_role;

drop function if exists public.list_group_activity_occupancies(bigint[]);
drop function if exists public.registration_enforce_capacity();
drop function if exists public.registration_sync_guest_count_from_normalized();
drop function if exists public.registration_guest_count_from_normalized(uuid);
drop function if exists public.registration_pickup_people_count(bigint, text, uuid);
drop function if exists public.registration_attending_season_people_count(bigint, text, uuid);
drop function if exists public.registration_people_count(integer, integer);

-- Remove obsolete structures only after every live write/read function above
-- no longer depends on them.
drop table public.registration_cancellation_events;
drop table public.normalization_legacy_collection_archives;
alter table public.registrations drop column status, drop column guest_count;

comment on table public.registration_guests is
  'Canonical guest participation rows. cancelled_at retains cancellation history and invited_by identifies the inviting member.';
comment on table public.activity_dates is
  'Canonical activity dates. Retired dates remain available for historical registrations and leave states.';
