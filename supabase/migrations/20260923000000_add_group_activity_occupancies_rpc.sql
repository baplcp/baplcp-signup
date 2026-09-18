-- Return every active session's occupied places in one read for the group list.
-- Pickup registrations count self and guests. Season registrations count only
-- their self count, except on dates marked as leave.

create or replace function public.list_group_activity_occupancies(
  p_activity_ids bigint[]
)
returns table (
  activity_id bigint,
  activity_date date,
  occupied_count integer
)
language sql
stable
security invoker
as $$
  with requested_dates as (
    select
      date_row.id,
      date_row.activity_id,
      date_row.activity_date
    from public.activity_dates as date_row
    where date_row.is_active
      and date_row.activity_id = any(p_activity_ids)
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
    coalesce(pickup_occupancies.occupied_count, 0) + coalesce(season_occupancies.occupied_count, 0) as occupied_count
  from requested_dates
  left join pickup_occupancies on pickup_occupancies.activity_date_id = requested_dates.id
  left join season_occupancies on season_occupancies.activity_date_id = requested_dates.id;
$$;

revoke all on function public.list_group_activity_occupancies(bigint[]) from public;
grant execute on function public.list_group_activity_occupancies(bigint[]) to anon, authenticated, service_role;
