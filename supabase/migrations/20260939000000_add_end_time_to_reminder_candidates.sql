-- Expose activity end time so reminder messages can show the full time range.
-- The return type changes, so the function must be dropped before recreation.
drop function if exists public.list_activity_reminder_notification_candidates(date, integer);

create function public.list_activity_reminder_notification_candidates(
  p_today date,
  p_hour integer
)
returns table (
  id bigint,
  title text,
  pickup_label text,
  location text,
  start_time text,
  end_time text,
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
    activity.end_time::text,
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

revoke all on function public.list_activity_reminder_notification_candidates(date, integer) from public;
grant execute on function public.list_activity_reminder_notification_candidates(date, integer) to service_role;
