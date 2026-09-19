-- Scheduled Edge Functions run frequently. Select only the rows that can
-- produce a notification instead of transferring every active activity date.
create index if not exists activities_season_open_notification_idx
  on public.activities (season_open_date, season_open_time)
  where season_enabled and season_open_date is not null and season_open_time is not null;

create or replace function public.list_registration_open_notification_candidates(
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns table (
  activity_id bigint,
  title text,
  pickup_label text,
  location text,
  start_time text,
  end_time text,
  activity_date date,
  notification_type text
)
language sql
stable
security invoker
as $$
  select
    activity.id as activity_id,
    activity.title,
    activity.pickup_label,
    activity.location,
    activity.start_time::text,
    activity.end_time::text,
    first_activity_date.activity_date,
    'season'::text as notification_type
  from public.activities as activity
  left join lateral (
    select date_row.activity_date
    from public.activity_dates as date_row
    where date_row.activity_id = activity.id
      and date_row.is_active
    order by date_row.sort_order
    limit 1
  ) as first_activity_date on true
  where activity.season_enabled
    and activity.season_open_date is not null
    and activity.season_open_time is not null
    and activity.season_open_date >= (p_window_start at time zone 'Asia/Taipei')::date
    and activity.season_open_date <= (p_window_end at time zone 'Asia/Taipei')::date
    and ((activity.season_open_date + activity.season_open_time) at time zone 'Asia/Taipei') >= p_window_start
    and ((activity.season_open_date + activity.season_open_time) at time zone 'Asia/Taipei') < p_window_end

  union all

  select
    activity.id as activity_id,
    activity.title,
    activity.pickup_label,
    activity.location,
    activity.start_time::text,
    activity.end_time::text,
    date_row.activity_date,
    'pickup'::text as notification_type
  from public.activity_dates as date_row
  join public.activities as activity on activity.id = date_row.activity_id
  where date_row.is_active
    and activity.pickup_open_days_before between 1 and 7
    and activity.pickup_open_time is not null
    and date_row.activity_date >= (p_window_start at time zone 'Asia/Taipei')::date
    and date_row.activity_date <= (p_window_end at time zone 'Asia/Taipei')::date + 7
    and ((date_row.activity_date - activity.pickup_open_days_before + activity.pickup_open_time) at time zone 'Asia/Taipei') >= p_window_start
    and ((date_row.activity_date - activity.pickup_open_days_before + activity.pickup_open_time) at time zone 'Asia/Taipei') < p_window_end;
$$;

create or replace function public.list_activity_reminder_notification_candidates(
  p_today date,
  p_hour integer
)
returns table (
  id bigint,
  title text,
  pickup_label text,
  location text,
  start_time text,
  single_capacity integer,
  pickup_fee_per_session numeric,
  ac_enabled boolean,
  ac_fee numeric,
  reminder_days_before integer,
  activity_date_id bigint,
  activity_date date
)
language sql
stable
security invoker
as $$
  select
    activity.id,
    activity.title,
    activity.pickup_label,
    activity.location,
    activity.start_time::text,
    activity.single_capacity,
    activity.pickup_fee_per_session,
    activity.ac_enabled,
    activity.ac_fee,
    activity.reminder_days_before,
    date_row.id as activity_date_id,
    date_row.activity_date
  from public.activity_dates as date_row
  join public.activities as activity on activity.id = date_row.activity_id
  where date_row.is_active
    and activity.reminder_enabled
    and activity.reminder_days_before between 1 and 7
    and activity.reminder_time is not null
    and extract(hour from activity.reminder_time) = p_hour
    and date_row.activity_date >= p_today + 1
    and date_row.activity_date <= p_today + 7
    and date_row.activity_date = p_today + activity.reminder_days_before;
$$;

revoke all on function public.list_registration_open_notification_candidates(timestamptz, timestamptz) from public;
revoke all on function public.list_activity_reminder_notification_candidates(date, integer) from public;
grant execute on function public.list_registration_open_notification_candidates(timestamptz, timestamptz) to service_role;
grant execute on function public.list_activity_reminder_notification_candidates(date, integer) to service_role;
