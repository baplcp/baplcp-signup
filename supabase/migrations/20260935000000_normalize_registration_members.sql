-- Keep member profile data in members. Registrations own attendance data only.

alter table public.members
  add column if not exists picture_url text;

-- Preserve profile values that existed only on historical registrations before
-- removing the duplicate columns. Existing member profile values take priority.
with latest_registration_profiles as (
  select distinct on (registration.user_id)
    registration.user_id,
    registration.display_name,
    registration.picture_url
  from public.registrations as registration
  where registration.user_id is not null
  order by registration.user_id, registration.created_at desc
)
update public.members as member
set display_name = coalesce(nullif(member.display_name, ''), profile.display_name),
    picture_url = coalesce(member.picture_url, profile.picture_url)
from latest_registration_profiles as profile
where member.user_id = profile.user_id;

-- Historical registrations predate profile synchronization in some installs.
-- Create a canonical member row for those records before enforcing the FK.
insert into public.members (user_id, display_name, picture_url, role)
select distinct on (registration.user_id)
  registration.user_id,
  coalesce(nullif(registration.display_name, ''), '未命名'),
  registration.picture_url,
  'member'
from public.registrations as registration
left join public.members as member on member.user_id = registration.user_id
where member.id is null
  and registration.user_id is not null
order by registration.user_id, registration.created_at desc;

alter table public.registrations
  add column if not exists member_id uuid;

update public.registrations as registration
set member_id = member.id
from public.members as member
where registration.member_id is null
  and member.user_id = registration.user_id;

do $$
begin
  if exists (select 1 from public.registrations where member_id is null) then
    raise exception 'registration_member_backfill_incomplete';
  end if;
end;
$$;

alter table public.registrations
  alter column member_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registrations_id_member_id_unique'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations
      add constraint registrations_id_member_id_unique unique (id, member_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registrations_member_id_fkey'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations
      add constraint registrations_member_id_fkey
      foreign key (member_id) references public.members(id)
      on delete restrict;
  end if;
end;
$$;

drop index if exists public.registrations_active_pickup_user_unique;
drop index if exists public.registrations_active_pickup_activity_date_user_unique;
drop index if exists public.registrations_active_season_user_unique;

create unique index registrations_active_pickup_activity_date_member_unique
  on public.registrations (activity_id, activity_date_id, member_id)
  where status = 'active' and activity_date_id is not null;

create unique index registrations_active_season_member_unique
  on public.registrations (activity_id, member_id)
  where status = 'active' and activity_date_id is null;

create index registrations_member_id_idx
  on public.registrations (member_id);

-- Cancellation events belong to the same member as their registration. A
-- guest's name remains event data, while member names and photos come from
-- members at read time.
alter table public.registration_cancellation_events
  add column if not exists member_id uuid,
  add column if not exists guest_display_name text;

update public.registration_cancellation_events as cancellation
set member_id = registration.member_id,
    guest_display_name = case
      when cancellation.participant_type = 'guest' then cancellation.display_name
      else null
    end
from public.registrations as registration
where registration.id = cancellation.registration_id
  and cancellation.member_id is null;

do $$
begin
  if exists (select 1 from public.registration_cancellation_events where member_id is null) then
    raise exception 'registration_cancellation_event_member_backfill_incomplete';
  end if;
end;
$$;

alter table public.registration_cancellation_events
  alter column member_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registration_cancellation_events_member_id_fkey'
      and conrelid = 'public.registration_cancellation_events'::regclass
  ) then
    alter table public.registration_cancellation_events
      add constraint registration_cancellation_events_member_id_fkey
      foreign key (member_id) references public.members(id)
      on delete restrict;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registration_cancellation_events_registration_member_fkey'
      and conrelid = 'public.registration_cancellation_events'::regclass
  ) then
    alter table public.registration_cancellation_events
      add constraint registration_cancellation_events_registration_member_fkey
      foreign key (registration_id, member_id)
      references public.registrations(id, member_id)
      on delete cascade;
  end if;
end;
$$;

alter table public.registration_cancellation_events
  add constraint registration_cancellation_events_self_guest_name_check
  check (participant_type <> 'self' or guest_display_name is null);

-- Season status is derived from registrations through the member FK.
create or replace function public.sync_member_season_status_from_registrations()
returns trigger
language plpgsql
as $$
declare
  affected_member_ids uuid[] := array[]::uuid[];
begin
  if tg_op = 'UPDATE'
    and old.member_id is not distinct from new.member_id
    and old.activity_date_id is not distinct from new.activity_date_id
    and old.status is not distinct from new.status then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.activity_date_id is null then
    affected_member_ids := array_append(affected_member_ids, old.member_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.activity_date_id is null then
    affected_member_ids := array_append(affected_member_ids, new.member_id);
  end if;

  if cardinality(affected_member_ids) = 0 then
    return null;
  end if;

  update public.members as member
  set is_season = exists (
    select 1
    from public.registrations as registration
    where registration.member_id = member.id
      and registration.activity_date_id is null
      and registration.status = 'active'
  )
  where member.id = any(affected_member_ids)
    and member.is_season is distinct from exists (
      select 1
      from public.registrations as registration
      where registration.member_id = member.id
        and registration.activity_date_id is null
        and registration.status = 'active'
    );

  return null;
end;
$$;

drop trigger if exists registrations_sync_member_season_status on public.registrations;
create trigger registrations_sync_member_season_status
after insert or update of member_id, activity_date_id, status or delete on public.registrations
for each row
execute function public.sync_member_season_status_from_registrations();

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
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;
  if p_payload ? 'guests' and jsonb_typeof(p_payload -> 'guests') <> 'array' then
    raise exception 'invalid_guests' using errcode = '22023';
  end if;
  if p_payload ? 'cancelled_members' and jsonb_typeof(p_payload -> 'cancelled_members') <> 'array' then
    raise exception 'invalid_cancelled_members' using errcode = '22023';
  end if;

  if p_registration_id is null then
    target_activity_id := (p_payload ->> 'activity_id')::bigint;
    target_activity_date_id := nullif(p_payload ->> 'activity_date_id', '')::bigint;
    target_member_id := nullif(p_payload ->> 'member_id', '')::uuid;
  else
    select registration.activity_id,
           case when p_payload ? 'activity_date_id' then nullif(p_payload ->> 'activity_date_id', '')::bigint else registration.activity_date_id end,
           case when p_payload ? 'member_id' then nullif(p_payload ->> 'member_id', '')::uuid else registration.member_id end
    into target_activity_id, target_activity_date_id, target_member_id
    from public.registrations as registration
    where registration.id = p_registration_id;
    if target_activity_id is null then
      raise exception 'registration_not_found' using errcode = 'P0002';
    end if;
    if p_payload ? 'activity_id' then
      target_activity_id := (p_payload ->> 'activity_id')::bigint;
    end if;
  end if;

  if target_activity_id is null then
    raise exception 'invalid_activity_id' using errcode = '22023';
  end if;
  if target_member_id is null or not exists (select 1 from public.members where id = target_member_id) then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if target_activity_date_id is not null and not exists (
    select 1 from public.activity_dates as activity_date
    where activity_date.id = target_activity_date_id
      and activity_date.activity_id = target_activity_id
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  if p_registration_id is null then
    insert into public.registrations (
      activity_id, activity_date_id, member_id,
      self_count, self_added_at, guest_count, status, paid_court, paid_ac, season_plan
    ) values (
      target_activity_id, target_activity_date_id, target_member_id,
      coalesce((p_payload ->> 'self_count')::integer, 0),
      public.normalization_safe_timestamptz(p_payload ->> 'self_added_at'),
      case when p_payload ? 'guests' then jsonb_array_length(p_payload -> 'guests') else 0 end,
      coalesce(p_payload ->> 'status', 'active'),
      coalesce((p_payload ->> 'paid_court')::boolean, false),
      coalesce((p_payload ->> 'paid_ac')::boolean, false),
      coalesce(p_payload ->> 'season_plan', 'quarter')
    )
    returning id into target_registration_id;
  else
    update public.registrations as registration
    set activity_id = target_activity_id,
        activity_date_id = target_activity_date_id,
        member_id = target_member_id,
        self_count = case when p_payload ? 'self_count' then (p_payload ->> 'self_count')::integer else registration.self_count end,
        self_added_at = case when p_payload ? 'self_added_at' then public.normalization_safe_timestamptz(p_payload ->> 'self_added_at') else registration.self_added_at end,
        guest_count = case when p_payload ? 'guests' then jsonb_array_length(p_payload -> 'guests') else registration.guest_count end,
        status = case when p_payload ? 'status' then p_payload ->> 'status' else registration.status end,
        paid_court = case when p_payload ? 'paid_court' then (p_payload ->> 'paid_court')::boolean else registration.paid_court end,
        paid_ac = case when p_payload ? 'paid_ac' then (p_payload ->> 'paid_ac')::boolean else registration.paid_ac end,
        season_plan = case when p_payload ? 'season_plan' then p_payload ->> 'season_plan' else registration.season_plan end
    where registration.id = p_registration_id
    returning registration.id into target_registration_id;
  end if;

  if p_payload ? 'guests' then
    delete from public.registration_guests where registration_id = target_registration_id;
    insert into public.registration_guests (
      registration_id, guest_position, display_name, gender, joined_at, paid_court, paid_ac, legacy_payload
    )
    select
      target_registration_id,
      item.ordinality::integer - 1,
      nullif(btrim(item.value ->> 'name'), ''),
      case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end,
      public.normalization_safe_timestamptz(item.value ->> 'added_at'),
      case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end,
      case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end,
      item.value
    from jsonb_array_elements(p_payload -> 'guests') with ordinality as item(value, ordinality);
  end if;

  if p_payload ? 'cancelled_members' then
    delete from public.registration_cancellation_events
    where registration_id = target_registration_id and legacy_source = 'cancelled_members';
    insert into public.registration_cancellation_events (
      registration_id, legacy_source, legacy_position, participant_type,
      member_id, guest_display_name, participant_added_at
    )
    select
      target_registration_id,
      'cancelled_members',
      item.ordinality::integer - 1,
      case when item.value ? 'addedBy' then 'guest' else 'self' end,
      target_member_id,
      case when item.value ? 'addedBy' then nullif(btrim(item.value ->> 'name'), '') else null end,
      public.normalization_safe_timestamptz(item.value ->> 'time')
    from jsonb_array_elements(p_payload -> 'cancelled_members') with ordinality as item(value, ordinality);
  end if;

  return target_registration_id;
end;
$$;

-- The UI reads a denormalized response, but its member fields are built from
-- the relationship rather than stored on registrations.
create or replace function public.get_activity_page(
  p_activity_id bigint default null,
  p_activity_date_id bigint default null
)
returns jsonb
language sql
stable
security invoker
as $$
  with target_activity as (
    select activity.* from public.activities as activity
    where p_activity_id is null or activity.id = p_activity_id
    order by activity.created_at desc limit 1
  ), activity_dates as (
    select date_row.id, date_row.activity_date, date_row.sort_order
    from public.activity_dates as date_row
    join target_activity as activity on activity.id = date_row.activity_id
    where date_row.is_active
  ), selected_date as (
    select date_row.id, date_row.activity_date from activity_dates as date_row
    order by case when date_row.id = p_activity_date_id then 0 else 1 end,
      case when date_row.activity_date >= (now() at time zone 'Asia/Taipei')::date then 0 else 1 end,
      case when date_row.activity_date >= (now() at time zone 'Asia/Taipei')::date then date_row.activity_date end asc,
      case when date_row.activity_date < (now() at time zone 'Asia/Taipei')::date then date_row.activity_date end desc
    limit 1
  ), registration_payloads as (
    select registration.activity_date_id, registration.status, registration.created_at,
      jsonb_build_object(
        'id', registration.id, 'activity_id', registration.activity_id,
        'activity_date_id', registration.activity_date_id,
        'activity_date', case when registration.activity_date_id is null then null else selected_date.activity_date end,
        'user_id', member.user_id, 'display_name', member.display_name, 'picture_url', member.picture_url,
        'self_count', registration.self_count, 'guest_count', registration.guest_count, 'status', registration.status,
        'created_at', registration.created_at, 'self_added_at', registration.self_added_at,
        'paid_court', registration.paid_court, 'paid_ac', registration.paid_ac, 'season_plan', registration.season_plan,
        'member_gender', member.gender,
        'guests', coalesce((select jsonb_agg(jsonb_build_object('name', guest.display_name, 'gender', guest.gender, 'added_at', guest.joined_at, 'paid_court', guest.paid_court, 'paid_ac', guest.paid_ac) order by guest.guest_position) from public.registration_guests as guest where guest.registration_id = registration.id), '[]'::jsonb),
        'leave_dates', coalesce((select jsonb_agg(date_row.activity_date order by date_row.activity_date) from public.season_registration_date_statuses as date_status join activity_dates as date_row on date_row.id = date_status.activity_date_id where date_status.registration_id = registration.id and date_status.is_on_leave), '[]'::jsonb),
        'leave_times', coalesce((select jsonb_object_agg(date_row.activity_date::text, date_status.leave_submitted_at) from public.season_registration_date_statuses as date_status join activity_dates as date_row on date_row.id = date_status.activity_date_id where date_status.registration_id = registration.id and date_status.leave_submitted_at is not null), '{}'::jsonb),
        'rejoin_times', coalesce((select jsonb_object_agg(date_row.activity_date::text, date_status.rejoined_at) from public.season_registration_date_statuses as date_status join activity_dates as date_row on date_row.id = date_status.activity_date_id where date_status.registration_id = registration.id and date_status.rejoined_at is not null), '{}'::jsonb),
        'cancelled_members', coalesce((select jsonb_agg(jsonb_build_object('name', case when cancellation.participant_type = 'guest' then coalesce(cancellation.guest_display_name, '群外') else coalesce(cancellation_member.display_name, '未命名') end, 'badge', left(case when cancellation.participant_type = 'guest' then coalesce(cancellation.guest_display_name, '群外') else coalesce(cancellation_member.display_name, '未命名') end, 1), 'image', case when cancellation.participant_type = 'self' then cancellation_member.picture_url else null end, 'time', cancellation.participant_added_at, 'addedBy', case when cancellation.participant_type = 'guest' then cancellation_member.display_name else null end) order by cancellation.legacy_position) from public.registration_cancellation_events as cancellation join public.members as cancellation_member on cancellation_member.id = cancellation.member_id where cancellation.registration_id = registration.id and cancellation.legacy_source = 'cancelled_members'), '[]'::jsonb)
      ) as payload
    from public.registrations as registration
    join public.members as member on member.id = registration.member_id
    cross join target_activity as activity
    left join selected_date on true
    where registration.activity_id = activity.id and registration.status in ('active', 'cancelled')
      and (registration.activity_date_id is null or registration.activity_date_id = selected_date.id)
  )
  select jsonb_build_object(
    'activity', jsonb_build_object(
      'id', activity.id, 'title', activity.title, 'location', activity.location, 'start_time', activity.start_time, 'end_time', activity.end_time,
      'single_capacity', activity.single_capacity, 'pickup_fee_per_session', activity.pickup_fee_per_session,
      'season_fee_per_session', activity.season_fee_per_session, 'season_half_year_fee_per_session', activity.season_half_year_fee_per_session,
      'season_total_fee', activity.season_total_fee, 'season_half_year_total_fee', activity.season_half_year_total_fee,
      'season_capacity', activity.season_capacity, 'season_enabled', activity.season_enabled, 'ac_enabled', activity.ac_enabled, 'ac_fee', activity.ac_fee,
      'pickup_open_days_before', activity.pickup_open_days_before, 'pickup_open_time', activity.pickup_open_time,
      'season_open_date', activity.season_open_date, 'season_open_time', activity.season_open_time,
      'season_close_date', activity.season_close_date, 'season_close_time', activity.season_close_time,
      'dates', coalesce((select jsonb_agg(date_row.activity_date order by date_row.sort_order) from activity_dates as date_row), '[]'::jsonb),
      'activity_dates', coalesce((select jsonb_agg(jsonb_build_object('id', date_row.id, 'activity_date', date_row.activity_date) order by date_row.sort_order) from activity_dates as date_row), '[]'::jsonb),
      'selected_activity_date_id', selected_date.id, 'selected_activity_date', selected_date.activity_date
    ),
    'pickup_registrations', coalesce((select jsonb_agg(payload order by created_at) from registration_payloads where activity_date_id is not null), '[]'::jsonb),
    'season_registrations', coalesce((select jsonb_agg(payload order by created_at) from registration_payloads where activity_date_id is null), '[]'::jsonb)
  ) from target_activity as activity left join selected_date on true;
$$;

create or replace function public.get_activity_registration(p_registration_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
  with target_registration as (
    select registration.*, member.user_id as member_user_id, member.display_name as member_display_name, member.picture_url as member_picture_url, member.gender as member_gender
    from public.registrations as registration
    join public.members as member on member.id = registration.member_id
    where registration.id = p_registration_id
  ), activity_dates as (
    select date_row.id, date_row.activity_date from public.activity_dates as date_row
    join target_registration as registration on registration.activity_id = date_row.activity_id where date_row.is_active
  )
  select jsonb_build_object(
    'id', registration.id, 'activity_id', registration.activity_id, 'activity_date_id', registration.activity_date_id,
    'activity_date', (select date_row.activity_date from public.activity_dates as date_row where date_row.id = registration.activity_date_id),
    'user_id', registration.member_user_id, 'display_name', registration.member_display_name, 'picture_url', registration.member_picture_url,
    'self_count', registration.self_count, 'guest_count', registration.guest_count, 'status', registration.status,
    'created_at', registration.created_at, 'self_added_at', registration.self_added_at, 'paid_court', registration.paid_court,
    'paid_ac', registration.paid_ac, 'season_plan', registration.season_plan, 'member_gender', registration.member_gender,
    'guests', coalesce((select jsonb_agg(jsonb_build_object('name', guest.display_name, 'gender', guest.gender, 'added_at', guest.joined_at, 'paid_court', guest.paid_court, 'paid_ac', guest.paid_ac) order by guest.guest_position) from public.registration_guests as guest where guest.registration_id = registration.id), '[]'::jsonb),
    'leave_dates', coalesce((select jsonb_agg(date_row.activity_date order by date_row.activity_date) from public.season_registration_date_statuses as date_status join activity_dates as date_row on date_row.id = date_status.activity_date_id where date_status.registration_id = registration.id and date_status.is_on_leave), '[]'::jsonb),
    'leave_times', coalesce((select jsonb_object_agg(date_row.activity_date::text, date_status.leave_submitted_at) from public.season_registration_date_statuses as date_status join activity_dates as date_row on date_row.id = date_status.activity_date_id where date_status.registration_id = registration.id and date_status.leave_submitted_at is not null), '{}'::jsonb),
    'rejoin_times', coalesce((select jsonb_object_agg(date_row.activity_date::text, date_status.rejoined_at) from public.season_registration_date_statuses as date_status join activity_dates as date_row on date_row.id = date_status.activity_date_id where date_status.registration_id = registration.id and date_status.rejoined_at is not null), '{}'::jsonb),
    'cancelled_members', coalesce((select jsonb_agg(jsonb_build_object('name', case when cancellation.participant_type = 'guest' then coalesce(cancellation.guest_display_name, '群外') else coalesce(cancellation_member.display_name, '未命名') end, 'badge', left(case when cancellation.participant_type = 'guest' then coalesce(cancellation.guest_display_name, '群外') else coalesce(cancellation_member.display_name, '未命名') end, 1), 'image', case when cancellation.participant_type = 'self' then cancellation_member.picture_url else null end, 'time', cancellation.participant_added_at, 'addedBy', case when cancellation.participant_type = 'guest' then cancellation_member.display_name else null end) order by cancellation.legacy_position) from public.registration_cancellation_events as cancellation join public.members as cancellation_member on cancellation_member.id = cancellation.member_id where cancellation.registration_id = registration.id and cancellation.legacy_source = 'cancelled_members'), '[]'::jsonb)
  ) from target_registration as registration;
$$;

create or replace function public.count_past_participations(p_user_id text, p_start_date date, p_end_date date)
returns bigint
language sql
stable
security invoker
as $$
  with taiwan_now as (select timezone('Asia/Taipei', now()) as value), target_member as (select id from public.members where user_id = p_user_id), pickup_count as (
    select count(*) as value from public.registrations as registration
    join target_member as member on member.id = registration.member_id
    join public.activity_dates as activity_date on activity_date.id = registration.activity_date_id and activity_date.activity_id = registration.activity_id
    join public.activities as activity on activity.id = registration.activity_id cross join taiwan_now
    where registration.status = 'active' and registration.self_count > 0 and activity_date.activity_date >= p_start_date
      and (activity_date.activity_date < p_end_date or (activity_date.activity_date = p_end_date and activity.end_time is not null and taiwan_now.value::time > activity.end_time))
  ), season_count as (
    select count(*) as value from public.registrations as registration
    join target_member as member on member.id = registration.member_id
    join public.activities as activity on activity.id = registration.activity_id
    join lateral (select (date_trunc('month', min(activity_date.activity_date)) + interval '3 months')::date as quarter_cutoff from public.activity_dates as activity_date where activity_date.activity_id = registration.activity_id) as activity_period on true
    join public.activity_dates as activity_date on activity_date.activity_id = registration.activity_id
    left join public.season_registration_date_statuses as date_status on date_status.registration_id = registration.id and date_status.activity_date_id = activity_date.id cross join taiwan_now
    where registration.status = 'active' and registration.self_count > 0 and registration.activity_date_id is null and activity_date.activity_date >= p_start_date
      and (activity_date.activity_date < p_end_date or (activity_date.activity_date = p_end_date and activity.end_time is not null and taiwan_now.value::time > activity.end_time))
      and (registration.season_plan = 'half-year' or (coalesce(registration.season_plan, 'quarter') = 'quarter' and activity_date.activity_date < activity_period.quarter_cutoff))
      and not coalesce(date_status.is_on_leave, false)
  ) select pickup_count.value + season_count.value from pickup_count cross join season_count;
$$;

alter table public.registrations
  drop column user_id,
  drop column display_name,
  drop column picture_url;

alter table public.registration_cancellation_events
  drop column display_name,
  drop column picture_url,
  drop column added_by,
  drop column legacy_payload;
