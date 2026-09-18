-- Store calendar dates and wall-clock times with their native PostgreSQL
-- types. These values do not identify an instant until they are combined with
-- an activity date in the Asia/Taipei time zone, so they intentionally do not
-- use timestamptz or time with time zone.
--
-- The original table predates the migration history and may already have one
-- or more native columns. Convert only text columns, but reject malformed
-- legacy values rather than silently losing them during conversion.
do $$
declare
  field record;
  current_type text;
  has_invalid_value boolean;
begin
  for field in
    select *
    from (
      values
        ('start_time', 'time without time zone', 'time'),
        ('end_time', 'time without time zone', 'time'),
        ('season_open_date', 'date', 'date'),
        ('season_open_time', 'time without time zone', 'time'),
        ('season_close_date', 'date', 'date'),
        ('season_close_time', 'time without time zone', 'time'),
        ('pickup_open_time', 'time without time zone', 'time'),
        ('pickup_close_time', 'time without time zone', 'time'),
        ('reminder_time', 'time without time zone', 'time')
    ) as fields(column_name, target_type, field_kind)
  loop
    select columns.data_type
    into current_type
    from information_schema.columns
    where columns.table_schema = 'public'
      and columns.table_name = 'activities'
      and columns.column_name = field.column_name;

    if current_type is null then
      raise exception 'activities.% is missing', field.column_name;
    end if;

    if current_type = field.target_type then
      continue;
    end if;

    if current_type <> 'text' then
      raise exception 'activities.% has unexpected type %', field.column_name, current_type;
    end if;

    if field.field_kind = 'date' then
      execute format(
        'select exists (
          select 1
          from public.activities
          where nullif(btrim(%1$I), '''') is not null
            and (
              btrim(%1$I) !~ %2$L
              or public.normalization_safe_date(btrim(%1$I)) is null
            )
        )',
        field.column_name,
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      ) into has_invalid_value;
    else
      execute format(
        'select exists (
          select 1
          from public.activities
          where nullif(btrim(%1$I), '''') is not null
            and btrim(%1$I) !~ %2$L
        )',
        field.column_name,
        '^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:[.][0-9]+)?)?$'
      ) into has_invalid_value;
    end if;

    if has_invalid_value then
      raise exception 'activities.% contains an invalid % value', field.column_name, field.field_kind;
    end if;

    -- Legacy text columns may have an empty-string default. It has no native
    -- date/time equivalent; the write RPC supplies every activity field.
    execute format(
      'alter table public.activities alter column %I drop default',
      field.column_name
    );

    execute format(
      'alter table public.activities
       alter column %1$I type %2$s
       using nullif(btrim(%1$I), '''')::%2$s',
      field.column_name,
      field.target_type
    );
  end loop;
end;
$$;

-- Keep JSON input explicit at the database boundary. The Edge Function
-- validates the same canonical YYYY-MM-DD and HH:mm formats before this RPC.
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
      p_payload ->> 'pickup_label', (p_payload ->> 'pickup_open_days_before')::integer,
      nullif(p_payload ->> 'pickup_open_time', '')::time,
      p_payload ->> 'pickup_deadline_type', (p_payload ->> 'pickup_close_days_before')::integer,
      nullif(p_payload ->> 'pickup_close_time', '')::time,
      (p_payload ->> 'reminder_enabled')::boolean, (p_payload ->> 'reminder_days_before')::integer,
      nullif(p_payload ->> 'reminder_time', '')::time
    )
    returning * into activity_row;
  else
    update public.activities as activity
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
        pickup_label = p_payload ->> 'pickup_label',
        pickup_open_days_before = (p_payload ->> 'pickup_open_days_before')::integer,
        pickup_open_time = nullif(p_payload ->> 'pickup_open_time', '')::time,
        pickup_deadline_type = p_payload ->> 'pickup_deadline_type',
        pickup_close_days_before = (p_payload ->> 'pickup_close_days_before')::integer,
        pickup_close_time = nullif(p_payload ->> 'pickup_close_time', '')::time,
        reminder_enabled = (p_payload ->> 'reminder_enabled')::boolean,
        reminder_days_before = (p_payload ->> 'reminder_days_before')::integer,
        reminder_time = nullif(p_payload ->> 'reminder_time', '')::time
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

-- Preserve the RPC's existing text response contract for browser callers,
-- while comparing native values directly in PostgreSQL.
create or replace function public.list_group_activity_sessions(
  p_segment text,
  p_limit integer,
  p_offset integer,
  p_now timestamptz
)
returns table (
  activity_id bigint,
  activity_date date,
  title text,
  location text,
  start_time text,
  end_time text,
  single_capacity integer,
  occupied_count integer
)
language sql
stable
security invoker
as $$
  with dated_sessions as (
    select
      date_row.id,
      date_row.activity_id,
      date_row.activity_date,
      activity.title,
      activity.location,
      activity.start_time,
      activity.end_time,
      activity.single_capacity,
      activity.created_at,
      case
        when activity.end_time is null then date_row.activity_date < (p_now at time zone 'Asia/Taipei')::date
        else ((date_row.activity_date + activity.end_time + interval '1 hour') at time zone 'Asia/Taipei') < p_now
      end as is_ended
    from public.activity_dates as date_row
    join public.activities as activity on activity.id = date_row.activity_id
    where date_row.is_active
  ), requested_dates as (
    select *
    from dated_sessions
    where (p_segment = 'upcoming' and not is_ended)
      or (p_segment = 'ended' and is_ended)
    order by
      case when p_segment = 'upcoming' then activity_date end asc,
      case when p_segment = 'ended' then activity_date end desc,
      created_at desc,
      id
    limit least(greatest(coalesce(p_limit, 0), 0), 50)
    offset greatest(coalesce(p_offset, 0), 0)
  ), pickup_occupancies as (
    select
      registration.activity_date_id,
      coalesce(
        sum(
          greatest(coalesce(registration.self_count, 0), 0)
          + greatest(coalesce(registration.guest_count, 0), 0)
        ),
        0
      )::integer as occupied_count
    from public.registrations as registration
    join requested_dates on requested_dates.id = registration.activity_date_id
    where registration.status = 'active'
    group by registration.activity_date_id
  ), season_occupancies as (
    select
      requested_dates.id as activity_date_id,
      coalesce(
        sum(
          case
            when date_status.is_on_leave then 0
            else greatest(coalesce(registration.self_count, 0), 0)
          end
        ),
        0
      )::integer as occupied_count
    from requested_dates
    left join public.registrations as registration
      on registration.activity_id = requested_dates.activity_id
      and registration.activity_date_id is null
      and registration.status = 'active'
    left join public.season_registration_date_statuses as date_status
      on date_status.registration_id = registration.id
      and date_status.activity_date_id = requested_dates.id
    group by requested_dates.id
  )
  select
    requested_dates.activity_id,
    requested_dates.activity_date,
    requested_dates.title,
    requested_dates.location,
    requested_dates.start_time::text,
    requested_dates.end_time::text,
    requested_dates.single_capacity,
    coalesce(pickup_occupancies.occupied_count, 0) + coalesce(season_occupancies.occupied_count, 0) as occupied_count
  from requested_dates
  left join pickup_occupancies on pickup_occupancies.activity_date_id = requested_dates.id
  left join season_occupancies on season_occupancies.activity_date_id = requested_dates.id;
$$;
