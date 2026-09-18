-- Return one page of group-list sessions with their occupied places calculated
-- in the database. Pickup registrations count self and guests. Season
-- registrations count only their self count, except on dates marked as leave.

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
        when nullif(btrim(activity.end_time), '') is null then date_row.activity_date < (p_now at time zone 'Asia/Taipei')::date
        else ((date_row.activity_date + nullif(btrim(activity.end_time), '')::time + interval '1 hour') at time zone 'Asia/Taipei') < p_now
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
    requested_dates.start_time,
    requested_dates.end_time,
    requested_dates.single_capacity,
    coalesce(pickup_occupancies.occupied_count, 0) + coalesce(season_occupancies.occupied_count, 0) as occupied_count
  from requested_dates
  left join pickup_occupancies on pickup_occupancies.activity_date_id = requested_dates.id
  left join season_occupancies on season_occupancies.activity_date_id = requested_dates.id;
$$;

revoke all on function public.list_group_activity_sessions(text, integer, integer, timestamptz) from public;
grant execute on function public.list_group_activity_sessions(text, integer, integer, timestamptz) to anon, authenticated, service_role;
