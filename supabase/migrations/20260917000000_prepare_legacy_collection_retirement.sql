-- Phase 4a: preserve legacy collections and make normalized rows the only
-- write target. Do not drop legacy columns until the v3 Edge Functions have
-- been deployed and production validation has remained clean.

create table if not exists public.normalization_legacy_collection_archives (
  source_table text not null check (source_table in ('activities', 'registrations')),
  source_id text not null,
  archived_at timestamptz not null default now(),
  payload jsonb not null,
  primary key (source_table, source_id)
);

alter table public.normalization_legacy_collection_archives enable row level security;

comment on table public.normalization_legacy_collection_archives is
  'Pre-retirement snapshots of legacy collection columns. A fallback writer refreshes its row until legacy fields are retired; no browser read policy is granted.';

insert into public.normalization_legacy_collection_archives (source_table, source_id, payload)
select
  'activities',
  activity.id::text,
  jsonb_build_object('dates', activity.dates)
from public.activities as activity
on conflict (source_table, source_id) do nothing;

insert into public.normalization_legacy_collection_archives (source_table, source_id, payload)
select
  'registrations',
  registration.id::text,
  jsonb_build_object(
    'activity_date', registration.activity_date,
    'guests', registration.guests,
    'cancelled_members', registration.cancelled_members,
    'cancelled_guests', registration.cancelled_guests,
    'leave_dates', to_jsonb(registration.leave_dates),
    'leave_times', registration.leave_times,
    'rejoin_times', registration.rejoin_times
  )
from public.registrations as registration
on conflict (source_table, source_id) do nothing;

-- v2 still writes legacy columns during the deployment handoff. Preserve its
-- latest value too; v3 does not update these columns, so its canonical writes
-- do not change an existing archive row.
create or replace function public.archive_legacy_activity_collections()
returns trigger
language plpgsql
as $$
begin
  insert into public.normalization_legacy_collection_archives (source_table, source_id, payload)
  values ('activities', new.id::text, jsonb_build_object('dates', new.dates))
  on conflict (source_table, source_id) do update
  set archived_at = now(),
      payload = excluded.payload;

  return null;
end;
$$;

create or replace function public.archive_legacy_registration_collections()
returns trigger
language plpgsql
as $$
begin
  insert into public.normalization_legacy_collection_archives (source_table, source_id, payload)
  values (
    'registrations',
    new.id::text,
    jsonb_build_object(
      'activity_date', new.activity_date,
      'guests', new.guests,
      'cancelled_members', new.cancelled_members,
      'cancelled_guests', new.cancelled_guests,
      'leave_dates', to_jsonb(new.leave_dates),
      'leave_times', new.leave_times,
      'rejoin_times', new.rejoin_times
    )
  )
  on conflict (source_table, source_id) do update
  set archived_at = now(),
      payload = excluded.payload;

  return null;
end;
$$;

drop trigger if exists activities_archive_legacy_collections on public.activities;
create trigger activities_archive_legacy_collections
after insert or update of dates on public.activities
for each row
execute function public.archive_legacy_activity_collections();

drop trigger if exists registrations_archive_legacy_collections on public.registrations;
create trigger registrations_archive_legacy_collections
after insert or update of activity_date, guests, cancelled_members, cancelled_guests, leave_dates, leave_times, rejoin_times on public.registrations
for each row
execute function public.archive_legacy_registration_collections();

-- activity_date_id is now the sole registration-type discriminator. These
-- indexes replace the text-date season indexes before v3 starts creating rows
-- without the compatibility activity_date value.
create unique index if not exists registrations_season_activity_date_id_unique
on public.registrations (user_id, activity_id)
where activity_date_id is null;

create unique index if not exists registrations_active_season_activity_date_id_unique
on public.registrations (activity_id, user_id)
where status = 'active' and activity_date_id is null;

drop index if exists public.registrations_season_unique;
drop index if exists public.registrations_active_season_user_unique;

create or replace function public.registration_enforce_capacity()
returns trigger
language plpgsql
as $$
declare
  activity_row public.activities;
  excluded_id uuid;
  capacity integer;
  total_people integer;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  select *
  into activity_row
  from public.activities
  where id = new.activity_id
  for update;

  if not found then
    raise exception 'activity_not_found' using errcode = 'P0001';
  end if;

  excluded_id := case when tg_op = 'UPDATE' then old.id else null end;

  -- single_capacity remains display-only. Season capacity is counted from
  -- canonical guest rows and season registrations have no activity_date_id.
  if new.activity_date_id is null then
    capacity := public.registration_season_capacity(activity_row);
    if capacity is not null and capacity > 0 then
      select coalesce(
        sum(
          greatest(coalesce(registration.self_count, 0), 0)
          + public.registration_guest_count_from_normalized(registration.id)
        ),
        0
      )::integer
      into total_people
      from public.registrations as registration
      where registration.activity_id = new.activity_id
        and registration.activity_date_id is null
        and registration.status = 'active'
        and (excluded_id is null or registration.id <> excluded_id);

      total_people := total_people
        + greatest(coalesce(new.self_count, 0), 0)
        + greatest(coalesce(new.guest_count, 0), 0);
      if total_people > capacity then
        raise exception 'season_capacity_exceeded' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_enforce_capacity on public.registrations;
create trigger registrations_enforce_capacity
before insert or update of activity_id, activity_date, activity_date_id, status, self_count, guest_count, guests
on public.registrations
for each row
execute function public.registration_enforce_capacity();

create or replace function public.sync_member_season_status_from_registrations()
returns trigger
language plpgsql
as $$
declare
  target_user_id text;
begin
  target_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  update public.members as member
  set is_season = exists (
    select 1
    from public.registrations as registration
    where registration.user_id = target_user_id
      and registration.activity_date_id is null
      and registration.status = 'active'
  )
  where member.user_id = target_user_id;

  return null;
end;
$$;

drop trigger if exists trg_season_member_on_register on public.registrations;
drop trigger if exists trg_season_member_on_cancel on public.registrations;
drop trigger if exists registrations_sync_member_season_status on public.registrations;
create trigger registrations_sync_member_season_status
after insert or update of user_id, activity_date_id, status or delete on public.registrations
for each row
execute function public.sync_member_season_status_from_registrations();

create or replace view public.member_pickup_summary as
select
  member.user_id,
  member.display_name,
  registration.activity_id,
  count(registration.id) as pickup_count,
  array_agg(activity_date.activity_date::text order by activity_date.activity_date) as pickup_dates
from public.members as member
join public.registrations as registration
  on registration.user_id = member.user_id
 and registration.activity_date_id is not null
 and registration.status = 'active'
join public.activity_dates as activity_date
  on activity_date.id = registration.activity_date_id
group by member.user_id, member.display_name, registration.activity_id;

create or replace function public.write_activity_v3(
  p_activity_id bigint,
  p_payload jsonb
)
returns public.activities
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  activity_row public.activities;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_activity_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload -> 'dates') <> 'array' then
    raise exception 'invalid_activity_dates' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_payload -> 'dates') as date_value(value)
    where public.normalization_safe_date(date_value.value) is null
  ) then
    raise exception 'invalid_activity_dates' using errcode = '22023';
  end if;

  perform set_config('app.normalization_write', 'on', true);

  if p_activity_id is null then
    insert into public.activities (
      game_type, title, location, start_time, end_time,
      season_fee_per_session, season_half_year_fee_per_session,
      pickup_fee_per_session, ac_fee, single_capacity, season_enabled,
      season_include_ac, season_total_fee, season_half_year_total_fee,
      season_capacity, season_open_date, season_open_time,
      season_deadline_type, season_close_date, season_close_time,
      pickup_label, pickup_open_days_before, pickup_open_time,
      pickup_deadline_type, pickup_close_days_before, pickup_close_time,
      reminder_enabled, reminder_days_before, reminder_time
    ) values (
      p_payload ->> 'game_type', p_payload ->> 'title', p_payload ->> 'location', p_payload ->> 'start_time', p_payload ->> 'end_time',
      (p_payload ->> 'season_fee_per_session')::integer, (p_payload ->> 'season_half_year_fee_per_session')::numeric,
      (p_payload ->> 'pickup_fee_per_session')::integer, (p_payload ->> 'ac_fee')::integer, (p_payload ->> 'single_capacity')::integer,
      (p_payload ->> 'season_enabled')::boolean, (p_payload ->> 'season_include_ac')::boolean,
      (p_payload ->> 'season_total_fee')::integer, (p_payload ->> 'season_half_year_total_fee')::numeric,
      p_payload ->> 'season_capacity', p_payload ->> 'season_open_date', p_payload ->> 'season_open_time',
      p_payload ->> 'season_deadline_type', p_payload ->> 'season_close_date', p_payload ->> 'season_close_time',
      p_payload ->> 'pickup_label', (p_payload ->> 'pickup_open_days_before')::integer, p_payload ->> 'pickup_open_time',
      p_payload ->> 'pickup_deadline_type', (p_payload ->> 'pickup_close_days_before')::integer, p_payload ->> 'pickup_close_time',
      (p_payload ->> 'reminder_enabled')::boolean, (p_payload ->> 'reminder_days_before')::integer, (p_payload ->> 'reminder_time')::time
    )
    returning * into activity_row;
  else
    update public.activities as activity
    set game_type = p_payload ->> 'game_type',
        title = p_payload ->> 'title',
        location = p_payload ->> 'location',
        start_time = p_payload ->> 'start_time',
        end_time = p_payload ->> 'end_time',
        season_fee_per_session = (p_payload ->> 'season_fee_per_session')::integer,
        season_half_year_fee_per_session = (p_payload ->> 'season_half_year_fee_per_session')::numeric,
        pickup_fee_per_session = (p_payload ->> 'pickup_fee_per_session')::integer,
        ac_fee = (p_payload ->> 'ac_fee')::integer,
        single_capacity = (p_payload ->> 'single_capacity')::integer,
        season_enabled = (p_payload ->> 'season_enabled')::boolean,
        season_include_ac = (p_payload ->> 'season_include_ac')::boolean,
        season_total_fee = (p_payload ->> 'season_total_fee')::integer,
        season_half_year_total_fee = (p_payload ->> 'season_half_year_total_fee')::numeric,
        season_capacity = p_payload ->> 'season_capacity',
        season_open_date = p_payload ->> 'season_open_date',
        season_open_time = p_payload ->> 'season_open_time',
        season_deadline_type = p_payload ->> 'season_deadline_type',
        season_close_date = p_payload ->> 'season_close_date',
        season_close_time = p_payload ->> 'season_close_time',
        pickup_label = p_payload ->> 'pickup_label',
        pickup_open_days_before = (p_payload ->> 'pickup_open_days_before')::integer,
        pickup_open_time = p_payload ->> 'pickup_open_time',
        pickup_deadline_type = p_payload ->> 'pickup_deadline_type',
        pickup_close_days_before = (p_payload ->> 'pickup_close_days_before')::integer,
        pickup_close_time = p_payload ->> 'pickup_close_time',
        reminder_enabled = (p_payload ->> 'reminder_enabled')::boolean,
        reminder_days_before = (p_payload ->> 'reminder_days_before')::integer,
        reminder_time = (p_payload ->> 'reminder_time')::time
    where activity.id = p_activity_id
    returning * into activity_row;

    if not found then
      raise exception 'activity_not_found' using errcode = 'P0002';
    end if;
  end if;

  update public.activity_dates
  set is_active = false,
      updated_at = now()
  where activity_id = activity_row.id
    and is_active;

  with input_dates as (
    select public.normalization_safe_date(item.value) as activity_date, min(item.ordinality)::integer as sort_order
    from jsonb_array_elements_text(p_payload -> 'dates') with ordinality as item(value, ordinality)
    group by public.normalization_safe_date(item.value)
  )
  insert into public.activity_dates (activity_id, activity_date, sort_order, is_active)
  select activity_row.id, input_dates.activity_date, input_dates.sort_order, true
  from input_dates
  on conflict (activity_id, activity_date) do update
  set sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now();

  return activity_row;
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

  -- Keep the remaining legacy-to-normalized triggers from interpreting a v3
  -- pickup as a season registration merely because its compatibility text
  -- column is intentionally no longer written.
  perform set_config('app.normalization_write', 'on', true);

  if p_registration_id is null then
    target_activity_id := (p_payload ->> 'activity_id')::bigint;
    target_activity_date_id := nullif(p_payload ->> 'activity_date_id', '')::bigint;
  else
    select registration.activity_id,
           case when p_payload ? 'activity_date_id' then nullif(p_payload ->> 'activity_date_id', '')::bigint else registration.activity_date_id end
    into target_activity_id, target_activity_date_id
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
  if target_activity_date_id is not null and not exists (
    select 1
    from public.activity_dates as activity_date
    where activity_date.id = target_activity_date_id
      and activity_date.activity_id = target_activity_id
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  if p_registration_id is null then
    insert into public.registrations (
      activity_id, activity_date_id, user_id, display_name, picture_url,
      self_count, self_added_at, guest_count, status, paid_court, paid_ac,
      season_plan
    ) values (
      target_activity_id, target_activity_date_id, p_payload ->> 'user_id', p_payload ->> 'display_name', p_payload ->> 'picture_url',
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
        user_id = case when p_payload ? 'user_id' then p_payload ->> 'user_id' else registration.user_id end,
        display_name = case when p_payload ? 'display_name' then p_payload ->> 'display_name' else registration.display_name end,
        picture_url = case when p_payload ? 'picture_url' then p_payload ->> 'picture_url' else registration.picture_url end,
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
    delete from public.registration_guests
    where registration_id = target_registration_id;

    insert into public.registration_guests (
      registration_id, guest_position, display_name, gender, joined_at,
      paid_court, paid_ac, legacy_payload
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
    where registration_id = target_registration_id
      and legacy_source = 'cancelled_members';

    insert into public.registration_cancellation_events (
      registration_id, legacy_source, legacy_position, participant_type,
      display_name, picture_url, added_by, participant_added_at, legacy_payload
    )
    select
      target_registration_id,
      'cancelled_members',
      item.ordinality::integer - 1,
      case when item.value ? 'addedBy' then 'guest' else 'self' end,
      nullif(btrim(item.value ->> 'name'), ''),
      nullif(btrim(item.value ->> 'image'), ''),
      nullif(btrim(item.value ->> 'addedBy'), ''),
      public.normalization_safe_timestamptz(item.value ->> 'time'),
      item.value
    from jsonb_array_elements(p_payload -> 'cancelled_members') with ordinality as item(value, ordinality);
  end if;

  return target_registration_id;
end;
$$;

create or replace function public.set_season_registration_date_status_v3(
  p_registration_id uuid,
  p_activity_date_id bigint,
  p_is_on_leave boolean,
  p_changed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.registrations as registration
    join public.activity_dates as activity_date
      on activity_date.id = p_activity_date_id
     and activity_date.activity_id = registration.activity_id
    where registration.id = p_registration_id
      and registration.activity_date_id is null
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  insert into public.season_registration_date_statuses (
    registration_id, activity_date_id, is_on_leave, leave_submitted_at, rejoined_at
  ) values (
    p_registration_id,
    p_activity_date_id,
    p_is_on_leave,
    case when p_is_on_leave then p_changed_at else null end,
    case when p_is_on_leave then null else p_changed_at end
  )
  on conflict (registration_id, activity_date_id) do update
  set is_on_leave = excluded.is_on_leave,
      leave_submitted_at = case when excluded.is_on_leave then excluded.leave_submitted_at else season_registration_date_statuses.leave_submitted_at end,
      rejoined_at = case when excluded.is_on_leave then season_registration_date_statuses.rejoined_at else excluded.rejoined_at end,
      updated_at = now();
end;
$$;

revoke all on function public.write_activity_v3(bigint, jsonb) from public;
revoke all on function public.write_registration_v3(uuid, jsonb) from public;
revoke all on function public.set_season_registration_date_status_v3(uuid, bigint, boolean, timestamptz) from public;

grant execute on function public.write_activity_v3(bigint, jsonb) to service_role;
grant execute on function public.write_registration_v3(uuid, jsonb) to service_role;
grant execute on function public.set_season_registration_date_status_v3(uuid, bigint, boolean, timestamptz) to service_role;
