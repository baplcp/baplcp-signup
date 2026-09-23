-- Keyset pagination keeps later group-list pages from rescanning every earlier
-- session. Date ranges use activity_dates_active_date_idx; only today's rows
-- need a wall-clock comparison to determine whether they have ended.
drop function if exists public.list_group_activity_sessions(text, integer, integer, timestamptz);

create function public.list_group_activity_sessions(
  p_segment text,
  p_limit integer,
  p_now timestamptz,
  p_cursor_activity_date date default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_activity_date_id bigint default null
)
returns table (
  activity_id bigint,
  activity_date date,
  title text,
  location text,
  start_time text,
  end_time text,
  single_capacity integer,
  occupied_count integer,
  activity_created_at timestamptz,
  activity_date_id bigint
)
language sql
stable
security invoker
as $$
  with local_time as (
    select (p_now at time zone 'Asia/Taipei')::date as today
  ), upcoming_requested_dates as (
    select
      date_row.id,
      date_row.activity_id,
      date_row.activity_date,
      activity.title,
      activity.location,
      activity.start_time,
      activity.end_time,
      activity.single_capacity,
      activity.created_at
    from public.activity_dates as date_row
    join public.activities as activity on activity.id = date_row.activity_id
    cross join local_time
    where p_segment = 'upcoming'
      and date_row.is_active
      and (
        date_row.activity_date > local_time.today
        or (
          date_row.activity_date = local_time.today
          and (
            activity.end_time is null
            or ((date_row.activity_date + activity.end_time + interval '1 hour') at time zone 'Asia/Taipei') >= p_now
          )
        )
      )
      and (
        p_cursor_activity_date is null
        or date_row.activity_date > p_cursor_activity_date
        or (
          date_row.activity_date = p_cursor_activity_date
          and (
            activity.created_at < p_cursor_created_at
            or (activity.created_at = p_cursor_created_at and date_row.id > p_cursor_activity_date_id)
          )
        )
      )
    order by date_row.activity_date asc, activity.created_at desc, date_row.id
    limit least(greatest(coalesce(p_limit, 0), 0), 50)
  ), ended_requested_dates as (
    select
      date_row.id,
      date_row.activity_id,
      date_row.activity_date,
      activity.title,
      activity.location,
      activity.start_time,
      activity.end_time,
      activity.single_capacity,
      activity.created_at
    from public.activity_dates as date_row
    join public.activities as activity on activity.id = date_row.activity_id
    cross join local_time
    where p_segment = 'ended'
      and date_row.is_active
      and (
        date_row.activity_date < local_time.today
        or (
          date_row.activity_date = local_time.today
          and activity.end_time is not null
          and ((date_row.activity_date + activity.end_time + interval '1 hour') at time zone 'Asia/Taipei') < p_now
        )
      )
      and (
        p_cursor_activity_date is null
        or date_row.activity_date < p_cursor_activity_date
        or (
          date_row.activity_date = p_cursor_activity_date
          and (
            activity.created_at < p_cursor_created_at
            or (activity.created_at = p_cursor_created_at and date_row.id > p_cursor_activity_date_id)
          )
        )
      )
    order by date_row.activity_date desc, activity.created_at desc, date_row.id
    limit least(greatest(coalesce(p_limit, 0), 0), 50)
  ), requested_dates as (
    select * from upcoming_requested_dates
    union all
    select * from ended_requested_dates
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
    coalesce(pickup_occupancies.occupied_count, 0) + coalesce(season_occupancies.occupied_count, 0) as occupied_count,
    requested_dates.created_at as activity_created_at,
    requested_dates.id as activity_date_id
  from requested_dates
  left join pickup_occupancies on pickup_occupancies.activity_date_id = requested_dates.id
  left join season_occupancies on season_occupancies.activity_date_id = requested_dates.id
  order by
    case when p_segment = 'upcoming' then requested_dates.activity_date end asc,
    case when p_segment = 'ended' then requested_dates.activity_date end desc,
    requested_dates.created_at desc,
    requested_dates.id;
$$;

revoke all on function public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint) from public;
grant execute on function public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint) to anon, authenticated, service_role;
