-- A registration row represents one member's own participation.  Guests are
-- independent participation rows: this preserves both histories when either
-- person cancels and later joins again.

alter table public.registration_guests
  add column if not exists activity_id bigint,
  add column if not exists activity_date_id bigint;

update public.registration_guests as guest
set activity_id = registration.activity_id,
    activity_date_id = registration.activity_date_id,
    created_at = coalesce(guest.joined_at, guest.created_at)
from public.registrations as registration
where registration.id = guest.registration_id
  and (guest.activity_id is null or guest.activity_date_id is null or guest.joined_at is not null);

-- A historical self registration's effective signup time was self_added_at.
-- Once a row means exactly one self participant, created_at is that time.
update public.registrations
set created_at = coalesce(self_added_at, created_at)
where self_count > 0
  and self_added_at is not null;

-- Guests are allowed without a current self registration (for example, while
-- a season member is on leave), so detach them before removing guest-only rows.
do $$
begin
  if exists (select 1 from public.registration_guests where activity_id is null or activity_date_id is null) then
    raise exception 'registration_guest_activity_date_missing';
  end if;
end;
$$;

alter table public.registration_guests
  alter column activity_id set not null,
  alter column activity_date_id set not null;

alter table public.registration_guests
  add constraint registration_guests_activity_id_fkey
    foreign key (activity_id) references public.activities(id) on delete cascade,
  add constraint registration_guests_activity_date_id_fkey
    foreign key (activity_date_id) references public.activity_dates(id) on delete cascade;

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
  capacity integer;
  occupied_total integer;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;

  if p_registration_id is null then
    target_activity_id := (p_payload ->> 'activity_id')::bigint;
    target_activity_date_id := nullif(p_payload ->> 'activity_date_id', '')::bigint;
    target_member_id := nullif(p_payload ->> 'member_id', '')::uuid;
  else
    select activity_id, activity_date_id, member_id
      into target_activity_id, target_activity_date_id, target_member_id
      from public.registrations where id = p_registration_id;
    if target_activity_id is null then
      raise exception 'registration_not_found' using errcode = 'P0002';
    end if;
  end if;

  if target_activity_id is null or target_member_id is null then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;
  if target_activity_date_id is not null and not exists (
    select 1 from public.activity_dates
    where id = target_activity_date_id and activity_id = target_activity_id
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  perform 1 from public.activities where id = target_activity_id for update;

  if p_registration_id is null then
    insert into public.registrations (activity_id, activity_date_id, member_id, paid_court, paid_ac, season_plan, cancelled_at)
    values (
      target_activity_id, target_activity_date_id, target_member_id,
      coalesce((p_payload ->> 'paid_court')::boolean, false),
      coalesce((p_payload ->> 'paid_ac')::boolean, false),
      coalesce(p_payload ->> 'season_plan', 'quarter'),
      public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at')
    ) returning id into target_registration_id;
  else
    update public.registrations as registration
    set cancelled_at = case when p_payload ? 'cancelled_at' then public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at') else registration.cancelled_at end,
        paid_court = case when p_payload ? 'paid_court' then (p_payload ->> 'paid_court')::boolean else registration.paid_court end,
        paid_ac = case when p_payload ? 'paid_ac' then (p_payload ->> 'paid_ac')::boolean else registration.paid_ac end,
        season_plan = case when p_payload ? 'season_plan' then p_payload ->> 'season_plan' else registration.season_plan end
    where registration.id = p_registration_id
    returning registration.id into target_registration_id;
  end if;

  if target_activity_date_id is null then
    select case
      when nullif(btrim(season_capacity::text), '') is null then null
      when lower(season_capacity::text) = 'unlimited' then null
      when season_capacity::text ~ '^\\d+$' then season_capacity::integer
      else null
    end into capacity from public.activities where id = target_activity_id;
    if capacity is not null and capacity > 0 then
      select count(*)::integer into occupied_total from public.registrations
      where activity_id = target_activity_id and activity_date_id is null and cancelled_at is null;
      if occupied_total > capacity then raise exception 'season_capacity_exceeded' using errcode = 'P0001'; end if;
    end if;
  else
    select single_capacity into capacity from public.activities where id = target_activity_id;
    if capacity is not null and capacity > 0 then
      select
        (select count(*) from public.registrations where activity_date_id = target_activity_date_id and cancelled_at is null)
        + (select count(*) from public.registration_guests where activity_date_id = target_activity_date_id and cancelled_at is null)
        + (select count(*) from public.registrations as registration
           left join public.season_registration_date_statuses as date_status
             on date_status.registration_id = registration.id and date_status.activity_date_id = target_activity_date_id
           where registration.activity_id = target_activity_id and registration.activity_date_id is null
             and registration.cancelled_at is null and not coalesce(date_status.is_on_leave, false))
      into occupied_total;
      if occupied_total > capacity then raise exception 'single_capacity_exceeded' using errcode = 'P0001'; end if;
    end if;
  end if;
  return target_registration_id;
end;
$$;

create or replace function public.write_registration_guests_v1(
  p_activity_id bigint,
  p_activity_date_id bigint,
  p_invited_by uuid,
  p_guests jsonb,
  p_invitation_limit integer default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  capacity integer;
  occupied_total integer;
  active_guest_total integer;
begin
  if jsonb_typeof(p_guests) <> 'array' then raise exception 'invalid_guests' using errcode = '22023'; end if;
  if not exists (select 1 from public.activity_dates where id = p_activity_date_id and activity_id = p_activity_id) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;
  perform 1 from public.activities where id = p_activity_id for update;

  if exists (
    select 1 from jsonb_array_elements(p_guests) as item(value)
    where nullif(item.value ->> 'id', '') is not null
      and not exists (select 1 from public.registration_guests as guest
        where guest.id = nullif(item.value ->> 'id', '')::uuid and guest.activity_id = p_activity_id
          and guest.activity_date_id = p_activity_date_id and guest.invited_by = p_invited_by and guest.cancelled_at is null)
  ) then raise exception 'guest_not_found' using errcode = 'P0002'; end if;

  update public.registration_guests as guest
  set cancelled_at = now(), updated_at = now()
  where guest.activity_id = p_activity_id and guest.activity_date_id = p_activity_date_id
    and guest.invited_by = p_invited_by and guest.cancelled_at is null
    and not exists (select 1 from jsonb_array_elements(p_guests) as item(value)
      where nullif(item.value ->> 'id', '')::uuid = guest.id);

  update public.registration_guests as guest
  set display_name = nullif(btrim(item.value ->> 'name'), ''),
      gender = case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end,
      paid_court = case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end,
      paid_ac = case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end,
      updated_at = now()
  from jsonb_array_elements(p_guests) as item(value)
  where guest.id = nullif(item.value ->> 'id', '')::uuid and guest.cancelled_at is null;

  insert into public.registration_guests (activity_id, activity_date_id, invited_by, display_name, gender, paid_court, paid_ac)
  select p_activity_id, p_activity_date_id, p_invited_by,
    nullif(btrim(item.value ->> 'name'), ''),
    case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end,
    case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end,
    case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end
  from jsonb_array_elements(p_guests) as item(value)
  where nullif(item.value ->> 'id', '') is null;

  if p_invitation_limit is not null then
    select count(*)::integer into active_guest_total from public.registration_guests
    where activity_id = p_activity_id and activity_date_id = p_activity_date_id
      and invited_by = p_invited_by and cancelled_at is null;
    if active_guest_total > p_invitation_limit then raise exception 'guest_invitation_limit_exceeded' using errcode = 'P0001'; end if;
  end if;

  select single_capacity into capacity from public.activities where id = p_activity_id;
  if capacity is not null and capacity > 0 then
    select
      (select count(*) from public.registrations where activity_date_id = p_activity_date_id and cancelled_at is null)
      + (select count(*) from public.registration_guests where activity_date_id = p_activity_date_id and cancelled_at is null)
      + (select count(*) from public.registrations as registration left join public.season_registration_date_statuses as date_status
           on date_status.registration_id = registration.id and date_status.activity_date_id = p_activity_date_id
         where registration.activity_id = p_activity_id and registration.activity_date_id is null
           and registration.cancelled_at is null and not coalesce(date_status.is_on_leave, false))
    into occupied_total;
    if occupied_total > capacity then raise exception 'single_capacity_exceeded' using errcode = 'P0001'; end if;
  end if;
end;
$$;

create or replace function public.update_registration_guest_v1(p_guest_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_guest_payload' using errcode = '22023'; end if;
  update public.registration_guests as guest
  set cancelled_at = case when p_payload ? 'cancelled_at' then public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at') else guest.cancelled_at end,
      paid_court = case when p_payload ? 'paid_court' then (p_payload ->> 'paid_court')::boolean else guest.paid_court end,
      paid_ac = case when p_payload ? 'paid_ac' then (p_payload ->> 'paid_ac')::boolean else guest.paid_ac end,
      updated_at = now()
  where guest.id = p_guest_id;
  if not found then raise exception 'guest_not_found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.get_activity_registration(p_registration_id uuid)
returns jsonb language sql stable security invoker as $$
  select jsonb_build_object(
    'id', registration.id, 'is_self_registration', true,
    'activity_id', registration.activity_id, 'activity_date_id', registration.activity_date_id,
    'activity_date', activity_date.activity_date, 'user_id', member.user_id,
    'display_name', member.display_name, 'picture_url', member.picture_url,
    'cancelled_at', registration.cancelled_at, 'created_at', registration.created_at,
    'paid_court', registration.paid_court, 'paid_ac', registration.paid_ac,
    'season_plan', registration.season_plan, 'member_gender', member.gender,
    'guests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', guest.id, 'name', guest.display_name, 'gender', guest.gender,
      'created_at', guest.created_at, 'cancelled_at', guest.cancelled_at,
      'paid_court', guest.paid_court, 'paid_ac', guest.paid_ac, 'invited_by', guest.invited_by
    ) order by guest.created_at) from public.registration_guests as guest
      where guest.activity_id = registration.activity_id and guest.activity_date_id = registration.activity_date_id
        and guest.invited_by = registration.member_id
        and not exists (select 1 from public.registrations as newer_registration
          where newer_registration.activity_id = registration.activity_id
            and newer_registration.activity_date_id = registration.activity_date_id
            and newer_registration.member_id = registration.member_id
            and newer_registration.created_at > registration.created_at)), '[]'::jsonb),
    'leave_dates', coalesce((select jsonb_agg(date_row.activity_date order by date_row.activity_date)
      from public.season_registration_date_statuses as date_status join public.activity_dates as date_row on date_row.id = date_status.activity_date_id
      where date_status.registration_id = registration.id and date_status.is_on_leave), '[]'::jsonb),
    'leave_times', coalesce((select jsonb_object_agg(date_row.activity_date::text, date_status.leave_submitted_at)
      from public.season_registration_date_statuses as date_status join public.activity_dates as date_row on date_row.id = date_status.activity_date_id
      where date_status.registration_id = registration.id and date_status.leave_submitted_at is not null), '{}'::jsonb),
    'rejoin_times', coalesce((select jsonb_object_agg(date_row.activity_date::text, date_status.rejoined_at)
      from public.season_registration_date_statuses as date_status join public.activity_dates as date_row on date_row.id = date_status.activity_date_id
      where date_status.registration_id = registration.id and date_status.rejoined_at is not null), '{}'::jsonb)
  ) from public.registrations as registration join public.members as member on member.id = registration.member_id
    left join public.activity_dates as activity_date on activity_date.id = registration.activity_date_id
  where registration.id = p_registration_id;
$$;

create or replace function public.get_activity_page(p_activity_id bigint default null, p_activity_date_id bigint default null)
returns jsonb language sql stable security invoker as $$
  with target_activity as (
    select activity.* from public.activities as activity where p_activity_id is null or activity.id = p_activity_id order by activity.created_at desc limit 1
  ), activity_dates as (
    select date_row.id, date_row.activity_date, date_row.sort_order from public.activity_dates as date_row join target_activity as activity on activity.id = date_row.activity_id where date_row.is_active
  ), selected_date as (
    select date_row.id, date_row.activity_date from activity_dates as date_row
    order by case when date_row.id = p_activity_date_id then 0 else 1 end,
      case when date_row.activity_date >= (now() at time zone 'Asia/Taipei')::date then 0 else 1 end,
      case when date_row.activity_date >= (now() at time zone 'Asia/Taipei')::date then date_row.activity_date end asc,
      case when date_row.activity_date < (now() at time zone 'Asia/Taipei')::date then date_row.activity_date end desc limit 1
  ), registration_payloads as (
    select registration.activity_date_id, registration.created_at, public.get_activity_registration(registration.id) as payload
    from public.registrations as registration join target_activity as activity on activity.id = registration.activity_id left join selected_date on true
    where registration.activity_date_id is null or registration.activity_date_id = selected_date.id
  ), guest_only_payloads as (
    select guest.activity_date_id, min(guest.created_at) as created_at,
      jsonb_build_object('id', null, 'is_self_registration', false, 'activity_id', guest.activity_id,
        'activity_date_id', guest.activity_date_id, 'activity_date', activity_date.activity_date,
        'user_id', member.user_id, 'display_name', member.display_name, 'picture_url', member.picture_url,
        'cancelled_at', null, 'created_at', min(guest.created_at), 'paid_court', false, 'paid_ac', false,
        'season_plan', null, 'member_gender', member.gender,
        'guests', jsonb_agg(jsonb_build_object('id', guest.id, 'name', guest.display_name, 'gender', guest.gender,
          'created_at', guest.created_at, 'cancelled_at', guest.cancelled_at, 'paid_court', guest.paid_court,
          'paid_ac', guest.paid_ac, 'invited_by', guest.invited_by) order by guest.created_at),
        'leave_dates', '[]'::jsonb, 'leave_times', '{}'::jsonb, 'rejoin_times', '{}'::jsonb) as payload
    from public.registration_guests as guest join target_activity as activity on activity.id = guest.activity_id
      join selected_date on selected_date.id = guest.activity_date_id join public.members as member on member.id = guest.invited_by
      join public.activity_dates as activity_date on activity_date.id = guest.activity_date_id
    where not exists (select 1 from public.registrations as registration where registration.activity_id = guest.activity_id and registration.activity_date_id = guest.activity_date_id and registration.member_id = guest.invited_by)
    group by guest.activity_id, guest.activity_date_id, activity_date.activity_date, member.user_id, member.display_name, member.picture_url, member.gender
  ), all_payloads as (
    select * from registration_payloads union all select * from guest_only_payloads
  ) select jsonb_build_object(
    'activity', to_jsonb(activity) || jsonb_build_object('dates', coalesce((select jsonb_agg(activity_date order by sort_order) from activity_dates), '[]'::jsonb),
      'activity_dates', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'activity_date', activity_date) order by sort_order) from activity_dates), '[]'::jsonb),
      'selected_activity_date_id', selected_date.id, 'selected_activity_date', selected_date.activity_date),
    'pickup_registrations', coalesce((select jsonb_agg(payload order by created_at) from all_payloads where activity_date_id is not null), '[]'::jsonb),
    'season_registrations', coalesce((select jsonb_agg(payload order by created_at) from all_payloads where activity_date_id is null), '[]'::jsonb)
  ) from target_activity as activity left join selected_date on true;
$$;

create or replace function public.count_past_participations(p_user_id text, p_start_date date, p_end_date date)
returns bigint language sql stable security invoker as $$
  with taiwan_now as (select timezone('Asia/Taipei', now()) as value), target_member as (select id from public.members where user_id = p_user_id),
  pickup_count as (select count(*) as value from public.registrations as registration join target_member as member on member.id = registration.member_id join public.activity_dates as activity_date on activity_date.id = registration.activity_date_id join public.activities as activity on activity.id = registration.activity_id cross join taiwan_now
    where registration.cancelled_at is null and activity_date.activity_date >= p_start_date and (activity_date.activity_date < p_end_date or (activity_date.activity_date = p_end_date and activity.end_time is not null and taiwan_now.value::time > activity.end_time))),
  season_count as (select count(*) as value from public.registrations as registration join target_member as member on member.id = registration.member_id join public.activities as activity on activity.id = registration.activity_id join lateral (select (date_trunc('month', min(activity_date.activity_date)) + interval '3 months')::date as quarter_cutoff from public.activity_dates as activity_date where activity_date.activity_id = registration.activity_id) as activity_period on true join public.activity_dates as activity_date on activity_date.activity_id = registration.activity_id left join public.season_registration_date_statuses as date_status on date_status.registration_id = registration.id and date_status.activity_date_id = activity_date.id cross join taiwan_now
    where registration.cancelled_at is null and registration.activity_date_id is null and activity_date.activity_date >= p_start_date and (activity_date.activity_date < p_end_date or (activity_date.activity_date = p_end_date and activity.end_time is not null and taiwan_now.value::time > activity.end_time)) and (registration.season_plan = 'half-year' or (coalesce(registration.season_plan, 'quarter') = 'quarter' and activity_date.activity_date < activity_period.quarter_cutoff)) and not coalesce(date_status.is_on_leave, false))
  select pickup_count.value + season_count.value from pickup_count cross join season_count;
$$;

drop function if exists public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint);
create function public.list_group_activity_sessions(p_segment text, p_limit integer, p_now timestamptz, p_cursor_activity_date date default null, p_cursor_created_at timestamptz default null, p_cursor_activity_date_id bigint default null)
returns table (activity_id bigint, activity_date date, title text, location text, start_time text, end_time text, single_capacity integer, occupied_count integer, activity_created_at timestamptz, activity_date_id bigint)
language sql stable security invoker as $$
  with local_time as (select (p_now at time zone 'Asia/Taipei')::date as today), requested_dates as (
    select date_row.id, date_row.activity_id, date_row.activity_date, activity.title, activity.location, activity.start_time, activity.end_time, activity.single_capacity, activity.created_at
    from public.activity_dates as date_row join public.activities as activity on activity.id = date_row.activity_id cross join local_time
    where date_row.is_active
      and (
        (p_segment = 'upcoming' and (date_row.activity_date > local_time.today or (date_row.activity_date = local_time.today and (activity.end_time is null or ((date_row.activity_date + activity.end_time + interval '1 hour') at time zone 'Asia/Taipei') >= p_now))))
        or (p_segment = 'ended' and (date_row.activity_date < local_time.today or (date_row.activity_date = local_time.today and activity.end_time is not null and ((date_row.activity_date + activity.end_time + interval '1 hour') at time zone 'Asia/Taipei') < p_now)))
      )
      and (
        p_cursor_activity_date is null
        or (p_segment = 'upcoming' and (date_row.activity_date > p_cursor_activity_date or (date_row.activity_date = p_cursor_activity_date and (activity.created_at < p_cursor_created_at or (activity.created_at = p_cursor_created_at and date_row.id > p_cursor_activity_date_id)))))
        or (p_segment = 'ended' and (date_row.activity_date < p_cursor_activity_date or (date_row.activity_date = p_cursor_activity_date and (activity.created_at < p_cursor_created_at or (activity.created_at = p_cursor_created_at and date_row.id > p_cursor_activity_date_id)))))
      )
    order by case when p_segment = 'upcoming' then date_row.activity_date end asc, case when p_segment = 'ended' then date_row.activity_date end desc, activity.created_at desc, date_row.id limit least(greatest(coalesce(p_limit, 0), 0), 50)
  ), pickup_people as (select registration.activity_date_id, count(*)::integer as self_count from public.registrations as registration join requested_dates on requested_dates.id = registration.activity_date_id where registration.cancelled_at is null group by registration.activity_date_id),
  guest_people as (select guest.activity_date_id, count(*)::integer as guest_count from public.registration_guests as guest join requested_dates on requested_dates.id = guest.activity_date_id where guest.cancelled_at is null group by guest.activity_date_id),
  season_people as (select requested_dates.id as activity_date_id, count(registration.id) filter (where not coalesce(date_status.is_on_leave, false))::integer as self_count from requested_dates left join public.registrations as registration on registration.activity_id = requested_dates.activity_id and registration.activity_date_id is null and registration.cancelled_at is null left join public.season_registration_date_statuses as date_status on date_status.registration_id = registration.id and date_status.activity_date_id = requested_dates.id group by requested_dates.id)
  select requested_dates.activity_id, requested_dates.activity_date, requested_dates.title, requested_dates.location, requested_dates.start_time::text, requested_dates.end_time::text, requested_dates.single_capacity, coalesce(pickup_people.self_count, 0) + coalesce(guest_people.guest_count, 0) + coalesce(season_people.self_count, 0), requested_dates.created_at, requested_dates.id
  from requested_dates left join pickup_people on pickup_people.activity_date_id = requested_dates.id left join guest_people on guest_people.activity_date_id = requested_dates.id left join season_people on season_people.activity_date_id = requested_dates.id
  order by case when p_segment = 'upcoming' then requested_dates.activity_date end asc, case when p_segment = 'ended' then requested_dates.activity_date end desc, requested_dates.created_at desc, requested_dates.id;
$$;

-- All runtime functions above now use the direct participant columns, so the
-- parent-link and mutable-count columns can be safely removed.
drop policy if exists "public read registration guests" on public.registration_guests;
create policy "public read registration guests"
on public.registration_guests
for select
to anon, authenticated
using (
  exists (select 1 from public.activities where activities.id = registration_guests.activity_id)
);

drop index if exists public.registration_guests_active_position_unique;
drop index if exists public.registration_guests_registration_idx;
alter table public.registration_guests
  drop column registration_id,
  drop column guest_position,
  drop column joined_at;
drop index if exists public.registration_guests_invited_by_active_idx;
create index registration_guests_activity_date_inviter_active_idx
  on public.registration_guests (activity_id, activity_date_id, invited_by, cancelled_at, created_at);

-- Guest-only registrations were an implementation detail of the old model.
-- The old parent relation is gone, so deleting those rows cannot delete guests.
delete from public.registrations
where coalesce(self_count, 0) = 0
  and activity_date_id is not null;

alter table public.registrations
  drop column self_count,
  drop column self_added_at;

revoke all on function public.write_registration_v3(uuid, jsonb) from public;
grant execute on function public.write_registration_v3(uuid, jsonb) to service_role;
revoke all on function public.write_registration_guests_v1(bigint, bigint, uuid, jsonb, integer) from public;
grant execute on function public.write_registration_guests_v1(bigint, bigint, uuid, jsonb, integer) to service_role;
revoke all on function public.update_registration_guest_v1(uuid, jsonb) from public;
grant execute on function public.update_registration_guest_v1(uuid, jsonb) to service_role;
revoke all on function public.get_activity_page(bigint, bigint) from public;
grant execute on function public.get_activity_page(bigint, bigint) to anon, authenticated, service_role;
revoke all on function public.get_activity_registration(uuid) from public;
grant execute on function public.get_activity_registration(uuid) to anon, authenticated, service_role;
revoke all on function public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint) from public;
grant execute on function public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint) to anon, authenticated, service_role;

comment on table public.registrations is 'A member self-registration. created_at is the registration time; cancelled_at preserves cancellation history.';
comment on table public.registration_guests is 'An invited guest participation. created_at is the invitation time; cancelled_at preserves cancellation history.';
