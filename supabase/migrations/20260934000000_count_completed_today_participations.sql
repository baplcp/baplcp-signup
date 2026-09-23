-- Include a current-day registration once its activity has ended. Dates
-- without an end time remain excluded until the following day.
create or replace function public.count_past_participations(
  p_user_id text,
  p_start_date date,
  p_end_date date
)
returns bigint
language sql
stable
security invoker
as $$
  with taiwan_now as (
    select timezone('Asia/Taipei', now()) as value
  ), pickup_count as (
    select count(*) as value
    from public.registrations as registration
    join public.activity_dates as activity_date
      on activity_date.id = registration.activity_date_id
      and activity_date.activity_id = registration.activity_id
    join public.activities as activity
      on activity.id = registration.activity_id
    cross join taiwan_now
    where registration.user_id = p_user_id
      and registration.status = 'active'
      and registration.self_count > 0
      and activity_date.activity_date >= p_start_date
      and (
        activity_date.activity_date < p_end_date
        or (
          activity_date.activity_date = p_end_date
          and activity.end_time is not null
          and taiwan_now.value::time > activity.end_time
        )
      )
  ), season_count as (
    select count(*) as value
    from public.registrations as registration
    join public.activities as activity
      on activity.id = registration.activity_id
    join lateral (
      select (date_trunc('month', min(activity_date.activity_date)) + interval '3 months')::date as quarter_cutoff
      from public.activity_dates as activity_date
      where activity_date.activity_id = registration.activity_id
    ) as activity_period on true
    join public.activity_dates as activity_date
      on activity_date.activity_id = registration.activity_id
    left join public.season_registration_date_statuses as date_status
      on date_status.registration_id = registration.id
      and date_status.activity_date_id = activity_date.id
    cross join taiwan_now
    where registration.user_id = p_user_id
      and registration.status = 'active'
      and registration.self_count > 0
      and registration.activity_date_id is null
      and activity_date.activity_date >= p_start_date
      and (
        activity_date.activity_date < p_end_date
        or (
          activity_date.activity_date = p_end_date
          and activity.end_time is not null
          and taiwan_now.value::time > activity.end_time
        )
      )
      and (
        registration.season_plan = 'half-year'
        or coalesce(registration.season_plan, 'quarter') = 'quarter'
          and activity_date.activity_date < activity_period.quarter_cutoff
      )
      and not coalesce(date_status.is_on_leave, false)
  )
  select pickup_count.value + season_count.value
  from pickup_count
  cross join season_count;
$$;
