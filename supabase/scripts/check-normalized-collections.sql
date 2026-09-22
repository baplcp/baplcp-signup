-- Read-only integrity checks for the participant-level cancellation model.
-- No returned rows means the canonical tables agree.

with issues as (
  select
    'registration_activity_date_mismatch'::text,
    registration.id::text,
    jsonb_build_object(
      'registration_activity_id', registration.activity_id,
      'activity_date_id', registration.activity_date_id,
      'activity_date_activity_id', activity_date.activity_id
    )
  from public.registrations as registration
  join public.activity_dates as activity_date on activity_date.id = registration.activity_date_id
  where activity_date.activity_id is distinct from registration.activity_id

  union all

  select
    'season_status_activity_date_mismatch'::text,
    state.registration_id::text,
    jsonb_build_object(
      'registration_activity_id', registration.activity_id,
      'activity_date_id', state.activity_date_id,
      'activity_date_activity_id', activity_date.activity_id
    )
  from public.season_registration_date_statuses as state
  join public.registrations as registration on registration.id = state.registration_id
  join public.activity_dates as activity_date on activity_date.id = state.activity_date_id
  where registration.activity_date_id is not null
     or activity_date.activity_id is distinct from registration.activity_id

  union all

  select
    'active_pickup_duplicate'::text,
    min(registration.id::text),
    jsonb_build_object(
      'activity_id', registration.activity_id,
      'activity_date_id', registration.activity_date_id,
      'member_id', registration.member_id,
      'count', count(*)
    )
  from public.registrations as registration
  where registration.cancelled_at is null
    and registration.activity_date_id is not null
  group by registration.activity_id, registration.activity_date_id, registration.member_id
  having count(*) > 1

  union all

  select
    'active_season_duplicate'::text,
    min(registration.id::text),
    jsonb_build_object(
      'activity_id', registration.activity_id,
      'member_id', registration.member_id,
      'count', count(*)
    )
  from public.registrations as registration
  where registration.cancelled_at is null
    and registration.activity_date_id is null
  group by registration.activity_id, registration.member_id
  having count(*) > 1
)
select issue_type, source_id, details
from issues
order by issue_type, source_id;
