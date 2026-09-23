-- Phase 3: canonical normalized writes. These RPCs update normalized tables
-- first and keep the legacy JSON/array columns as compatibility snapshots in
-- the same transaction. Browser roles must never receive execute privileges.

create or replace function public.normalization_write_in_progress()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.normalization_write', true), '') = 'on';
$$;

-- Existing legacy writers remain supported. RPC writes set the transaction
-- local flag so these legacy-to-normalized triggers do not overwrite the
-- canonical rows that the RPC has just written.
drop trigger if exists registrations_set_activity_date_reference on public.registrations;
create trigger registrations_set_activity_date_reference
before insert or update of activity_id, activity_date on public.registrations
for each row
when (not public.normalization_write_in_progress())
execute function public.sync_registration_activity_date_reference();

drop trigger if exists registrations_sync_normalized_guests on public.registrations;
create trigger registrations_sync_normalized_guests
after insert or update of guests on public.registrations
for each row
when (not public.normalization_write_in_progress())
execute function public.sync_registration_guests_from_legacy_json();

drop trigger if exists registrations_sync_normalized_cancellations on public.registrations;
create trigger registrations_sync_normalized_cancellations
after insert or update of cancelled_members, cancelled_guests on public.registrations
for each row
when (not public.normalization_write_in_progress())
execute function public.sync_registration_cancellation_events_from_legacy_json();

drop trigger if exists registrations_sync_normalized_session_statuses on public.registrations;
create trigger registrations_sync_normalized_session_statuses
after insert or update of activity_id, activity_date, leave_dates, leave_times, rejoin_times on public.registrations
for each row
when (not public.normalization_write_in_progress())
execute function public.sync_season_registration_date_statuses_from_legacy();

drop trigger if exists activities_sync_normalized_sessions on public.activities;
create trigger activities_sync_normalized_sessions
after insert or update of dates on public.activities
for each row
when (not public.normalization_write_in_progress())
execute function public.sync_activity_dates_from_legacy_dates();

create or replace function public.write_activity_v2(
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
      game_type, title, location, dates, start_time, end_time,
      season_fee_per_session, season_half_year_fee_per_session,
      pickup_fee_per_session, ac_fee, single_capacity, season_enabled,
      season_include_ac, season_total_fee, season_half_year_total_fee,
      season_capacity, season_open_date, season_open_time,
      season_deadline_type, season_close_date, season_close_time,
      pickup_label, pickup_open_days_before, pickup_open_time,
      pickup_deadline_type, pickup_close_days_before, pickup_close_time,
      reminder_enabled, reminder_days_before, reminder_time
    ) values (
      p_payload ->> 'game_type', p_payload ->> 'title', p_payload ->> 'location', p_payload -> 'dates', p_payload ->> 'start_time', p_payload ->> 'end_time',
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
        dates = p_payload -> 'dates',
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

create or replace function public.write_registration_v2(
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
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;

  perform set_config('app.normalization_write', 'on', true);

  if p_registration_id is null then
    insert into public.registrations (
      activity_id, activity_date, activity_date_id, user_id, display_name,
      picture_url, self_count, self_added_at, guest_count, guests, status,
      paid_court, paid_ac, cancelled_members, season_plan
    ) values (
      (p_payload ->> 'activity_id')::bigint,
      p_payload ->> 'activity_date',
      case when p_payload ->> 'activity_date' is null then null else (
        select activity_date.id
        from public.activity_dates as activity_date
        where activity_date.activity_id = (p_payload ->> 'activity_id')::bigint
          and activity_date.activity_date = public.normalization_safe_date(p_payload ->> 'activity_date')
      ) end,
      p_payload ->> 'user_id', p_payload ->> 'display_name', p_payload ->> 'picture_url',
      coalesce((p_payload ->> 'self_count')::integer, 0),
      public.normalization_safe_timestamptz(p_payload ->> 'self_added_at'),
      coalesce((p_payload ->> 'guest_count')::integer, 0),
      coalesce(p_payload -> 'guests', '[]'::jsonb),
      coalesce(p_payload ->> 'status', 'active'),
      coalesce((p_payload ->> 'paid_court')::boolean, false),
      coalesce((p_payload ->> 'paid_ac')::boolean, false),
      coalesce(p_payload -> 'cancelled_members', '[]'::jsonb),
      coalesce(p_payload ->> 'season_plan', 'quarter')
    )
    returning id into target_registration_id;
  else
    update public.registrations as registration
    set activity_id = case when p_payload ? 'activity_id' then (p_payload ->> 'activity_id')::bigint else registration.activity_id end,
        activity_date = case when p_payload ? 'activity_date' then p_payload ->> 'activity_date' else registration.activity_date end,
        user_id = case when p_payload ? 'user_id' then p_payload ->> 'user_id' else registration.user_id end,
        display_name = case when p_payload ? 'display_name' then p_payload ->> 'display_name' else registration.display_name end,
        picture_url = case when p_payload ? 'picture_url' then p_payload ->> 'picture_url' else registration.picture_url end,
        self_count = case when p_payload ? 'self_count' then (p_payload ->> 'self_count')::integer else registration.self_count end,
        self_added_at = case when p_payload ? 'self_added_at' then public.normalization_safe_timestamptz(p_payload ->> 'self_added_at') else registration.self_added_at end,
        guest_count = case when p_payload ? 'guest_count' then (p_payload ->> 'guest_count')::integer else registration.guest_count end,
        guests = case when p_payload ? 'guests' then coalesce(p_payload -> 'guests', '[]'::jsonb) else registration.guests end,
        status = case when p_payload ? 'status' then p_payload ->> 'status' else registration.status end,
        paid_court = case when p_payload ? 'paid_court' then (p_payload ->> 'paid_court')::boolean else registration.paid_court end,
        paid_ac = case when p_payload ? 'paid_ac' then (p_payload ->> 'paid_ac')::boolean else registration.paid_ac end,
        cancelled_members = case when p_payload ? 'cancelled_members' then coalesce(p_payload -> 'cancelled_members', '[]'::jsonb) else registration.cancelled_members end,
        season_plan = case when p_payload ? 'season_plan' then p_payload ->> 'season_plan' else registration.season_plan end
    where registration.id = p_registration_id
    returning registration.id into target_registration_id;

    if not found then
      raise exception 'registration_not_found' using errcode = 'P0002';
    end if;

    if p_payload ? 'activity_id' or p_payload ? 'activity_date' then
      update public.registrations as registration
      set activity_date_id = case when registration.activity_date is null then null else (
        select activity_date.id
        from public.activity_dates as activity_date
        where activity_date.activity_id = registration.activity_id
          and activity_date.activity_date = public.normalization_safe_date(registration.activity_date)
      ) end
      where registration.id = target_registration_id;
    end if;
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
    from jsonb_array_elements(public.normalization_jsonb_array(p_payload -> 'guests')) with ordinality as item(value, ordinality);
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
    from jsonb_array_elements(public.normalization_jsonb_array(p_payload -> 'cancelled_members')) with ordinality as item(value, ordinality);
  end if;

  return target_registration_id;
end;
$$;

create or replace function public.set_season_registration_date_status_v2(
  p_registration_id uuid,
  p_activity_date text,
  p_is_on_leave boolean,
  p_changed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target_activity_date_id bigint;
  legacy_leave_dates text[];
  legacy_leave_times jsonb;
  legacy_rejoin_times jsonb;
begin
  if public.normalization_safe_date(p_activity_date) is null then
    raise exception 'invalid_activity_date' using errcode = '22023';
  end if;

  perform set_config('app.normalization_write', 'on', true);

  select activity_date.id
  into target_activity_date_id
  from public.registrations as registration
  join public.activity_dates as activity_date
    on activity_date.activity_id = registration.activity_id
   and activity_date.activity_date = public.normalization_safe_date(p_activity_date)
  where registration.id = p_registration_id
    and registration.activity_date is null;

  if target_activity_date_id is null then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  insert into public.season_registration_date_statuses (
    registration_id, activity_date_id, is_on_leave, leave_submitted_at, rejoined_at
  ) values (
    p_registration_id,
    target_activity_date_id,
    p_is_on_leave,
    case when p_is_on_leave then p_changed_at else null end,
    case when p_is_on_leave then null else p_changed_at end
  )
  on conflict (registration_id, activity_date_id) do update
  set is_on_leave = excluded.is_on_leave,
      leave_submitted_at = case when excluded.is_on_leave then excluded.leave_submitted_at else season_registration_date_statuses.leave_submitted_at end,
      rejoined_at = case when excluded.is_on_leave then season_registration_date_statuses.rejoined_at else excluded.rejoined_at end,
      updated_at = now();

  select
    coalesce(array_agg(activity_date.activity_date::text order by activity_date.activity_date) filter (where state.is_on_leave), '{}'::text[]),
    coalesce(jsonb_object_agg(activity_date.activity_date::text, to_jsonb(state.leave_submitted_at)) filter (where state.leave_submitted_at is not null), '{}'::jsonb),
    coalesce(jsonb_object_agg(activity_date.activity_date::text, to_jsonb(state.rejoined_at)) filter (where state.rejoined_at is not null), '{}'::jsonb)
  into legacy_leave_dates, legacy_leave_times, legacy_rejoin_times
  from public.season_registration_date_statuses as state
  join public.activity_dates as activity_date on activity_date.id = state.activity_date_id
  where state.registration_id = p_registration_id;

  update public.registrations
  set leave_dates = legacy_leave_dates,
      leave_times = legacy_leave_times,
      rejoin_times = legacy_rejoin_times
  where id = p_registration_id;
end;
$$;

revoke all on function public.write_activity_v2(bigint, jsonb) from public;
revoke all on function public.write_registration_v2(uuid, jsonb) from public;
revoke all on function public.set_season_registration_date_status_v2(uuid, text, boolean, timestamptz) from public;

grant execute on function public.write_activity_v2(bigint, jsonb) to service_role;
grant execute on function public.write_registration_v2(uuid, jsonb) to service_role;
grant execute on function public.set_season_registration_date_status_v2(uuid, text, boolean, timestamptz) to service_role;
