-- Hydrate one registration for Realtime updates without reloading the whole
-- activity page. Nested collections are aggregated separately to avoid row
-- multiplication between guests, leave states, and cancellation events.

create or replace function public.get_activity_registration(
  p_registration_id uuid
)
returns jsonb
language sql
stable
security invoker
as $$
  with target_registration as (
    select registration.*
    from public.registrations as registration
    where registration.id = p_registration_id
  ), activity_dates as (
    select date_row.id, date_row.activity_date
    from public.activity_dates as date_row
    join target_registration as registration on registration.activity_id = date_row.activity_id
    where date_row.is_active
  )
  select jsonb_build_object(
    'id', registration.id,
    'activity_id', registration.activity_id,
    'activity_date_id', registration.activity_date_id,
    'activity_date', (
      select date_row.activity_date
      from public.activity_dates as date_row
      where date_row.id = registration.activity_date_id
    ),
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
  )
  from target_registration as registration;
$$;

revoke all on function public.get_activity_registration(uuid) from public;
grant execute on function public.get_activity_registration(uuid) to anon, authenticated, service_role;
