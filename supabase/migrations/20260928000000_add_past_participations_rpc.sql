-- Count a member's attended sessions without transferring every historical
-- activity date and registration ID to the browser.
create index if not exists registrations_active_user_activity_date_idx
  on public.registrations (user_id, activity_date_id) include (activity_id)
  where status = 'active' and self_count > 0;

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
  with pickup_count as (
    select count(*) as value
    from public.registrations as registration
    join public.activity_dates as activity_date
      on activity_date.id = registration.activity_date_id
    where registration.user_id = p_user_id
      and registration.status = 'active'
      and registration.self_count > 0
      and activity_date.activity_date >= p_start_date
      and activity_date.activity_date < p_end_date
  ), season_count as (
    select count(*) as value
    from public.registrations as registration
    join public.activity_dates as activity_date
      on activity_date.activity_id = registration.activity_id
    left join public.season_registration_date_statuses as date_status
      on date_status.registration_id = registration.id
      and date_status.activity_date_id = activity_date.id
    where registration.user_id = p_user_id
      and registration.status = 'active'
      and registration.self_count > 0
      and registration.activity_date_id is null
      and activity_date.activity_date >= p_start_date
      and activity_date.activity_date < p_end_date
      and not coalesce(date_status.is_on_leave, false)
  )
  select pickup_count.value + season_count.value
  from pickup_count
  cross join season_count;
$$;

revoke all on function public.count_past_participations(text, date, date) from public;
grant execute on function public.count_past_participations(text, date, date) to anon, authenticated, service_role;
