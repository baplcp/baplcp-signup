-- Return every read model needed by the activity detail page in one payload.
-- Each nested collection is aggregated independently so guests, leave states,
-- and cancellation events cannot multiply one another in a flat join.

create index if not exists registrations_activity_date_status_created_idx
  on public.registrations (activity_id, activity_date_id, status, created_at);

create or replace function public.get_activity_page(
  p_activity_id bigint default null,
  p_activity_date_id bigint default null
)
returns jsonb
language sql
stable
security invoker
as $$
  with target_activity as (
    select activity.*
    from public.activities as activity
    where p_activity_id is null or activity.id = p_activity_id
    order by activity.created_at desc
    limit 1
  ), activity_dates as (
    select date_row.id, date_row.activity_date, date_row.sort_order
    from public.activity_dates as date_row
    join target_activity as activity on activity.id = date_row.activity_id
    where date_row.is_active
  ), selected_date as (
    select date_row.id, date_row.activity_date
    from activity_dates as date_row
    order by
      case when date_row.id = p_activity_date_id then 0 else 1 end,
      case when date_row.activity_date >= (now() at time zone 'Asia/Taipei')::date then 0 else 1 end,
      case when date_row.activity_date >= (now() at time zone 'Asia/Taipei')::date then date_row.activity_date end asc,
      case when date_row.activity_date < (now() at time zone 'Asia/Taipei')::date then date_row.activity_date end desc
    limit 1
  ), registration_payloads as (
    select
      registration.activity_date_id,
      registration.status,
      registration.created_at,
      jsonb_build_object(
        'id', registration.id,
        'activity_id', registration.activity_id,
        'activity_date_id', registration.activity_date_id,
        'activity_date', case when registration.activity_date_id is null then null else selected_date.activity_date end,
        'user_id', registration.user_id,
        'display_name', registration.display_name,
        'picture_url', registration.picture_url,
        'self_count', registration.self_count,
        'guest_count', registration.guest_count,
        'status', registration.status,
        'created_at', registration.created_at,
        'self_added_at', registration.self_added_at,
        'paid_court', registration.paid_court,
        'paid_ac', registration.paid_ac,
        'season_plan', registration.season_plan,
        'member_gender', (
          select member.gender
          from public.members as member
          where member.user_id = registration.user_id
        ),
        'guests', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'name', guest.display_name,
              'gender', guest.gender,
              'added_at', guest.joined_at,
              'paid_court', guest.paid_court,
              'paid_ac', guest.paid_ac
            )
            order by guest.guest_position
          )
          from public.registration_guests as guest
          where guest.registration_id = registration.id
        ), '[]'::jsonb),
        'leave_dates', coalesce((
          select jsonb_agg(date_row.activity_date order by date_row.activity_date)
          from public.season_registration_date_statuses as date_status
          join activity_dates as date_row on date_row.id = date_status.activity_date_id
          where date_status.registration_id = registration.id
            and date_status.is_on_leave
        ), '[]'::jsonb),
        'leave_times', coalesce((
          select jsonb_object_agg(date_row.activity_date::text, date_status.leave_submitted_at)
          from public.season_registration_date_statuses as date_status
          join activity_dates as date_row on date_row.id = date_status.activity_date_id
          where date_status.registration_id = registration.id
            and date_status.leave_submitted_at is not null
        ), '{}'::jsonb),
        'rejoin_times', coalesce((
          select jsonb_object_agg(date_row.activity_date::text, date_status.rejoined_at)
          from public.season_registration_date_statuses as date_status
          join activity_dates as date_row on date_row.id = date_status.activity_date_id
          where date_status.registration_id = registration.id
            and date_status.rejoined_at is not null
        ), '{}'::jsonb),
        'cancelled_members', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'name', coalesce(cancellation.display_name, '群外'),
              'badge', left(coalesce(cancellation.display_name, '群外'), 1),
              'image', cancellation.picture_url,
              'time', cancellation.participant_added_at,
              'addedBy', cancellation.added_by
            )
            order by cancellation.legacy_position
          )
          from public.registration_cancellation_events as cancellation
          where cancellation.registration_id = registration.id
            and cancellation.legacy_source = 'cancelled_members'
        ), '[]'::jsonb)
      ) as payload
    from public.registrations as registration
    cross join target_activity as activity
    left join selected_date on true
    where registration.activity_id = activity.id
      and registration.status in ('active', 'cancelled')
      and (registration.activity_date_id is null or registration.activity_date_id = selected_date.id)
  )
  select jsonb_build_object(
    'activity', jsonb_build_object(
      'id', activity.id,
      'title', activity.title,
      'location', activity.location,
      'start_time', activity.start_time,
      'end_time', activity.end_time,
      'single_capacity', activity.single_capacity,
      'pickup_fee_per_session', activity.pickup_fee_per_session,
      'season_fee_per_session', activity.season_fee_per_session,
      'season_half_year_fee_per_session', activity.season_half_year_fee_per_session,
      'season_total_fee', activity.season_total_fee,
      'season_half_year_total_fee', activity.season_half_year_total_fee,
      'season_capacity', activity.season_capacity,
      'season_enabled', activity.season_enabled,
      'ac_enabled', activity.ac_enabled,
      'ac_fee', activity.ac_fee,
      'pickup_open_days_before', activity.pickup_open_days_before,
      'pickup_open_time', activity.pickup_open_time,
      'season_open_date', activity.season_open_date,
      'season_open_time', activity.season_open_time,
      'season_close_date', activity.season_close_date,
      'season_close_time', activity.season_close_time,
      'dates', coalesce((
        select jsonb_agg(date_row.activity_date order by date_row.sort_order)
        from activity_dates as date_row
      ), '[]'::jsonb),
      'activity_dates', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', date_row.id, 'activity_date', date_row.activity_date)
          order by date_row.sort_order
        )
        from activity_dates as date_row
      ), '[]'::jsonb),
      'selected_activity_date_id', selected_date.id,
      'selected_activity_date', selected_date.activity_date
    ),
    'pickup_registrations', coalesce((
      select jsonb_agg(payload order by created_at)
      from registration_payloads
      where activity_date_id is not null
    ), '[]'::jsonb),
    'season_registrations', coalesce((
      select jsonb_agg(payload order by created_at)
      from registration_payloads
      where activity_date_id is null
    ), '[]'::jsonb)
  )
  from target_activity as activity
  left join selected_date on true;
$$;

revoke all on function public.get_activity_page(bigint, bigint) from public;
grant execute on function public.get_activity_page(bigint, bigint) to anon, authenticated, service_role;
