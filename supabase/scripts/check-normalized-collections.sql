-- Read-only reconciliation for the normalized collection migration.
--
-- Run this before and after deploying 20260916000000_normalize_registration_integrity_rules.sql
-- and the matching Edge Functions. No returned rows means all checked snapshots
-- and normalized rows agree. Run it only from the Supabase SQL editor or an
-- administrator connection; its output may include registration data.

with legacy_migration_issues as (
  select
    source_table,
    source_id,
    'legacy_parse_or_reference'::text as issue_type,
    jsonb_build_object(
      'column', source_column,
      'value', source_value,
      'details', details
    ) as details
  from public.normalization_migration_issues
), legacy_activity_dates as (
  select
    activity.id as activity_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'activity_date', parsed.activity_date,
          'sort_order', parsed.sort_order
        ) order by parsed.sort_order
      ) filter (where parsed.activity_date is not null),
      '[]'::jsonb
    ) as dates
  from public.activities as activity
  left join lateral (
    select
      public.normalization_safe_date(item.value) as activity_date,
      min(item.ordinality)::integer as sort_order
    from jsonb_array_elements_text(public.normalization_jsonb_array(activity.dates)) with ordinality as item(value, ordinality)
    where public.normalization_safe_date(item.value) is not null
    group by public.normalization_safe_date(item.value)
  ) as parsed on true
  group by activity.id
), normalized_activity_dates as (
  select
    activity.id as activity_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'activity_date', activity_date.activity_date,
          'sort_order', activity_date.sort_order
        ) order by activity_date.sort_order
      ) filter (where activity_date.id is not null),
      '[]'::jsonb
    ) as dates
  from public.activities as activity
  left join public.activity_dates as activity_date
    on activity_date.activity_id = activity.id
   and activity_date.is_active
  group by activity.id
), expected_guests as (
  select
    registration.id as registration_id,
    item.ordinality::integer - 1 as guest_position,
    nullif(btrim(item.value ->> 'name'), '') as display_name,
    case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end as gender,
    public.normalization_safe_timestamptz(item.value ->> 'added_at') as joined_at,
    case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end as paid_court,
    case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end as paid_ac,
    item.value as legacy_payload
  from public.registrations as registration
  cross join lateral jsonb_array_elements(public.normalization_jsonb_array(registration.guests)) with ordinality as item(value, ordinality)
), expected_cancellations as (
  select
    registration.id as registration_id,
    entries.legacy_source,
    entries.ordinality::integer - 1 as legacy_position,
    case when entries.legacy_source = 'cancelled_guests' or entries.value ? 'addedBy' then 'guest' else 'self' end as participant_type,
    nullif(btrim(entries.value ->> 'name'), '') as display_name,
    nullif(btrim(entries.value ->> 'image'), '') as picture_url,
    nullif(btrim(entries.value ->> 'addedBy'), '') as added_by,
    public.normalization_safe_timestamptz(entries.value ->> 'time') as participant_added_at,
    entries.value as legacy_payload
  from public.registrations as registration
  cross join lateral (
    select 'cancelled_members'::text as legacy_source, item.value, item.ordinality
    from jsonb_array_elements(public.normalization_jsonb_array(registration.cancelled_members)) with ordinality as item(value, ordinality)
    union all
    select 'cancelled_guests'::text as legacy_source, item.value, item.ordinality
    from jsonb_array_elements(public.normalization_jsonb_array(registration.cancelled_guests)) with ordinality as item(value, ordinality)
  ) as entries
), raw_season_statuses as (
  select
    registration.id as registration_id,
    registration.activity_id,
    leave_date as source_date,
    true as is_on_leave,
    null::timestamptz as leave_submitted_at,
    null::timestamptz as rejoined_at
  from public.registrations as registration
  cross join lateral unnest(coalesce(registration.leave_dates, '{}'::text[])) as leave_date
  where registration.activity_id is not null
    and registration.activity_date is null

  union all

  select registration.id, registration.activity_id, entry.key, false, public.normalization_safe_timestamptz(entry.value), null::timestamptz
  from public.registrations as registration
  cross join lateral jsonb_each_text(public.normalization_jsonb_object(registration.leave_times)) as entry(key, value)
  where registration.activity_id is not null
    and registration.activity_date is null

  union all

  select registration.id, registration.activity_id, entry.key, false, null::timestamptz, public.normalization_safe_timestamptz(entry.value)
  from public.registrations as registration
  cross join lateral jsonb_each_text(public.normalization_jsonb_object(registration.rejoin_times)) as entry(key, value)
  where registration.activity_id is not null
    and registration.activity_date is null
), expected_season_statuses as (
  select
    normalized.registration_id,
    normalized.activity_id,
    normalized.activity_date,
    activity_date.id as activity_date_id,
    normalized.is_on_leave,
    normalized.leave_submitted_at,
    normalized.rejoined_at
  from (
    select
      registration_id,
      activity_id,
      public.normalization_safe_date(source_date) as activity_date,
      bool_or(is_on_leave) as is_on_leave,
      max(leave_submitted_at) as leave_submitted_at,
      max(rejoined_at) as rejoined_at
    from raw_season_statuses
    group by registration_id, activity_id, public.normalization_safe_date(source_date)
  ) as normalized
  left join public.activity_dates as activity_date
    on activity_date.activity_id = normalized.activity_id
   and activity_date.activity_date = normalized.activity_date
), reconciliation_issues as (
  select
    'activities'::text as source_table,
    legacy.activity_id::text as source_id,
    'activity_dates_snapshot_mismatch'::text as issue_type,
    jsonb_build_object('legacy_dates', legacy.dates, 'normalized_active_dates', normalized.dates) as details
  from legacy_activity_dates as legacy
  join normalized_activity_dates as normalized using (activity_id)
  where legacy.dates is distinct from normalized.dates

  union all

  select
    'registrations',
    coalesce(expected.registration_id, actual.registration_id)::text,
    'registration_guest_mismatch',
    jsonb_build_object(
      'guest_position', coalesce(expected.guest_position, actual.guest_position),
      'legacy_payload', expected.legacy_payload,
      'normalized_payload', actual.legacy_payload
    )
  from expected_guests as expected
  full join public.registration_guests as actual
    on actual.registration_id = expected.registration_id
   and actual.guest_position = expected.guest_position
  where actual.id is null
     or expected.registration_id is null
     or actual.display_name is distinct from expected.display_name
     or actual.gender is distinct from expected.gender
     or actual.joined_at is distinct from expected.joined_at
     or actual.paid_court is distinct from expected.paid_court
     or actual.paid_ac is distinct from expected.paid_ac
     or actual.legacy_payload is distinct from expected.legacy_payload

  union all

  select
    'registrations',
    coalesce(expected.registration_id, actual.registration_id)::text,
    'registration_cancellation_mismatch',
    jsonb_build_object(
      'legacy_source', coalesce(expected.legacy_source, actual.legacy_source),
      'legacy_position', coalesce(expected.legacy_position, actual.legacy_position),
      'legacy_payload', expected.legacy_payload,
      'normalized_payload', actual.legacy_payload
    )
  from expected_cancellations as expected
  full join public.registration_cancellation_events as actual
    on actual.registration_id = expected.registration_id
   and actual.legacy_source = expected.legacy_source
   and actual.legacy_position = expected.legacy_position
  where actual.id is null
     or expected.registration_id is null
     or actual.participant_type is distinct from expected.participant_type
     or actual.display_name is distinct from expected.display_name
     or actual.picture_url is distinct from expected.picture_url
     or actual.added_by is distinct from expected.added_by
     or actual.participant_added_at is distinct from expected.participant_added_at
     or actual.legacy_payload is distinct from expected.legacy_payload

  union all

  select
    'registrations',
    coalesce(expected.registration_id, actual.registration_id)::text,
    'season_date_status_mismatch',
    jsonb_build_object(
      'activity_date', coalesce(expected.activity_date, actual_date.activity_date),
      'legacy_state', jsonb_build_object(
        'is_on_leave', expected.is_on_leave,
        'leave_submitted_at', expected.leave_submitted_at,
        'rejoined_at', expected.rejoined_at
      ),
      'normalized_state', jsonb_build_object(
        'is_on_leave', actual.is_on_leave,
        'leave_submitted_at', actual.leave_submitted_at,
        'rejoined_at', actual.rejoined_at
      )
    )
  from expected_season_statuses as expected
  full join public.season_registration_date_statuses as actual
    on actual.registration_id = expected.registration_id
   and actual.activity_date_id = expected.activity_date_id
  left join public.activity_dates as actual_date on actual_date.id = actual.activity_date_id
  where actual.registration_id is null
     or expected.registration_id is null
     or expected.activity_date_id is null
     or actual.is_on_leave is distinct from expected.is_on_leave
     or actual.leave_submitted_at is distinct from expected.leave_submitted_at
     or actual.rejoined_at is distinct from expected.rejoined_at

  union all

  select
    'registrations',
    registration.id::text,
    'registration_guest_count_mismatch',
    jsonb_build_object(
      'legacy_guest_count', registration.guest_count,
      'normalized_guest_count', (
        select count(*)::integer
        from public.registration_guests as guest
        where guest.registration_id = registration.id
      )
    )
  from public.registrations as registration
  where registration.guest_count is distinct from (
    select count(*)::integer
    from public.registration_guests as guest
    where guest.registration_id = registration.id
  )

  union all

  select
    'registrations',
    registration.id::text,
    'activity_date_reference_mismatch',
    jsonb_build_object(
      'activity_date', registration.activity_date,
      'actual_activity_date_id', registration.activity_date_id,
      'expected_activity_date_id', activity_date.id
    )
  from public.registrations as registration
  left join public.activity_dates as activity_date
    on activity_date.activity_id = registration.activity_id
   and activity_date.activity_date = public.normalization_safe_date(registration.activity_date)
  where registration.activity_date is not null
    and registration.activity_date_id is distinct from activity_date.id
)
select source_table, source_id, issue_type, details
from legacy_migration_issues

union all

select source_table, source_id, issue_type, details
from reconciliation_issues

order by source_table, source_id, issue_type;
