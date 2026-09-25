-- Consolidate authorization, date cleanup, and activity writes in one RPC.
-- A null organizer ID is reserved for the Edge Function's local-dev path.

create or replace function public.write_activity_v5(
  p_activity_id bigint,
  p_organizer_user_id text,
  p_payload jsonb
)
returns public.seasons
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  activity_row public.seasons;
  removed_activity_date_ids bigint[];
begin
  if p_organizer_user_id is not null and not exists (
    select 1
    from public.members as member
    where member.user_id = p_organizer_user_id
      and member.role = 'organizer'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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

  if jsonb_typeof(coalesce(p_payload -> 'removed_activity_date_ids', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_activity_date_ids' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_payload -> 'removed_activity_date_ids', '[]'::jsonb)) as removed_id(value)
    where removed_id.value !~ '^[1-9][0-9]*$'
      or length(removed_id.value) > 18
  ) then
    raise exception 'invalid_activity_date_ids' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct removed_id.value::bigint), '{}'::bigint[])
    into removed_activity_date_ids
  from jsonb_array_elements_text(coalesce(p_payload -> 'removed_activity_date_ids', '[]'::jsonb)) as removed_id(value);

  if p_activity_id is not null and cardinality(removed_activity_date_ids) > 0 then
    perform 1
    from public.seasons as season
    where season.id = p_activity_id
    for update;

    if not found then
      raise exception 'activity_not_found' using errcode = 'P0002';
    end if;

    if exists (
      select 1
      from unnest(removed_activity_date_ids) as removed_id(id)
      where not exists (
        select 1
        from public.activity_dates as activity_date
        where activity_date.id = removed_id.id
          and activity_date.season_id = p_activity_id
      )
    ) then
      raise exception 'invalid_activity_date_ids' using errcode = '22023';
    end if;

    delete from public.season_registration_date_statuses
    where activity_date_id = any(removed_activity_date_ids);

    delete from public.registration_guests
    where season_id = p_activity_id
      and activity_date_id = any(removed_activity_date_ids);

    delete from public.registrations
    where season_id = p_activity_id
      and activity_date_id = any(removed_activity_date_ids);

    delete from public.activity_dates
    where season_id = p_activity_id
      and id = any(removed_activity_date_ids);
  end if;

  perform set_config('app.normalization_write', 'on', true);

  if p_activity_id is null then
    insert into public.seasons (
      game_type, title, location, start_time, end_time,
      season_fee_per_session, season_half_year_fee_per_session,
      pickup_fee_per_session, ac_fee, single_capacity, season_enabled,
      season_include_ac, season_total_fee, season_half_year_total_fee,
      season_capacity, season_open_date, season_open_time,
      season_deadline_type, season_close_date, season_close_time,
      season_late_enabled, season_late_total_fee,
      season_late_open_date, season_late_open_time,
      season_late_deadline_type, season_late_close_date, season_late_close_time,
      pickup_label, pickup_open_days_before, pickup_open_time,
      pickup_deadline_type, pickup_close_days_before, pickup_close_time,
      reminder_enabled, reminder_days_before, reminder_time
    ) values (
      p_payload ->> 'game_type', p_payload ->> 'title', p_payload ->> 'location',
      nullif(p_payload ->> 'start_time', '')::time,
      nullif(p_payload ->> 'end_time', '')::time,
      (p_payload ->> 'season_fee_per_session')::integer, (p_payload ->> 'season_half_year_fee_per_session')::numeric,
      (p_payload ->> 'pickup_fee_per_session')::integer, (p_payload ->> 'ac_fee')::integer, (p_payload ->> 'single_capacity')::integer,
      (p_payload ->> 'season_enabled')::boolean, (p_payload ->> 'season_include_ac')::boolean,
      (p_payload ->> 'season_total_fee')::integer, (p_payload ->> 'season_half_year_total_fee')::numeric,
      p_payload ->> 'season_capacity',
      nullif(p_payload ->> 'season_open_date', '')::date,
      nullif(p_payload ->> 'season_open_time', '')::time,
      p_payload ->> 'season_deadline_type',
      nullif(p_payload ->> 'season_close_date', '')::date,
      nullif(p_payload ->> 'season_close_time', '')::time,
      coalesce((p_payload ->> 'season_late_enabled')::boolean, false),
      (p_payload ->> 'season_late_total_fee')::numeric,
      nullif(p_payload ->> 'season_late_open_date', '')::date,
      nullif(p_payload ->> 'season_late_open_time', '')::time,
      p_payload ->> 'season_late_deadline_type',
      nullif(p_payload ->> 'season_late_close_date', '')::date,
      nullif(p_payload ->> 'season_late_close_time', '')::time,
      p_payload ->> 'pickup_label', (p_payload ->> 'pickup_open_days_before')::integer,
      nullif(p_payload ->> 'pickup_open_time', '')::time,
      p_payload ->> 'pickup_deadline_type', (p_payload ->> 'pickup_close_days_before')::integer,
      nullif(p_payload ->> 'pickup_close_time', '')::time,
      (p_payload ->> 'reminder_enabled')::boolean, (p_payload ->> 'reminder_days_before')::integer,
      nullif(p_payload ->> 'reminder_time', '')::time
    )
    returning * into activity_row;
  else
    update public.seasons as season
    set game_type = p_payload ->> 'game_type',
        title = p_payload ->> 'title',
        location = p_payload ->> 'location',
        start_time = nullif(p_payload ->> 'start_time', '')::time,
        end_time = nullif(p_payload ->> 'end_time', '')::time,
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
        season_open_date = nullif(p_payload ->> 'season_open_date', '')::date,
        season_open_time = nullif(p_payload ->> 'season_open_time', '')::time,
        season_deadline_type = p_payload ->> 'season_deadline_type',
        season_close_date = nullif(p_payload ->> 'season_close_date', '')::date,
        season_close_time = nullif(p_payload ->> 'season_close_time', '')::time,
        season_late_enabled = coalesce((p_payload ->> 'season_late_enabled')::boolean, false),
        season_late_total_fee = (p_payload ->> 'season_late_total_fee')::numeric,
        season_late_open_date = nullif(p_payload ->> 'season_late_open_date', '')::date,
        season_late_open_time = nullif(p_payload ->> 'season_late_open_time', '')::time,
        season_late_deadline_type = p_payload ->> 'season_late_deadline_type',
        season_late_close_date = nullif(p_payload ->> 'season_late_close_date', '')::date,
        season_late_close_time = nullif(p_payload ->> 'season_late_close_time', '')::time,
        pickup_label = p_payload ->> 'pickup_label',
        pickup_open_days_before = (p_payload ->> 'pickup_open_days_before')::integer,
        pickup_open_time = nullif(p_payload ->> 'pickup_open_time', '')::time,
        pickup_deadline_type = p_payload ->> 'pickup_deadline_type',
        pickup_close_days_before = (p_payload ->> 'pickup_close_days_before')::integer,
        pickup_close_time = nullif(p_payload ->> 'pickup_close_time', '')::time,
        reminder_enabled = (p_payload ->> 'reminder_enabled')::boolean,
        reminder_days_before = (p_payload ->> 'reminder_days_before')::integer,
        reminder_time = nullif(p_payload ->> 'reminder_time', '')::time
    where season.id = p_activity_id
    returning * into activity_row;

    if not found then
      raise exception 'activity_not_found' using errcode = 'P0002';
    end if;
  end if;

  with input_dates as (
    select public.normalization_safe_date(item.value) as activity_date
    from jsonb_array_elements_text(p_payload -> 'dates') as item(value)
    group by public.normalization_safe_date(item.value)
  )
  insert into public.activity_dates (season_id, activity_date)
  select activity_row.id, input_dates.activity_date
  from input_dates
  on conflict (season_id, activity_date) do nothing;

  return activity_row;
end;
$$;

drop function if exists public.write_activity_v4(bigint, text, jsonb);
drop function if exists public.write_activity_v5(bigint, jsonb);
drop function if exists public.write_activity_v3(bigint, jsonb);

revoke all on function public.write_activity_v5(bigint, text, jsonb) from public;
grant execute on function public.write_activity_v5(bigint, text, jsonb) to service_role;
