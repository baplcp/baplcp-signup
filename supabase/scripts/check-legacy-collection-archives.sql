-- Run after 20260917000000_prepare_legacy_collection_retirement.sql and
-- before 20260918000000_retire_legacy_collection_columns.sql. No rows means
-- the legacy columns still match their archive. v3 does not update legacy
-- columns, so this remains valid throughout the final validation period.

with expected as (
  select
    'activities'::text as source_table,
    activity.id::text as source_id,
    jsonb_build_object('dates', activity.dates) as payload
  from public.activities as activity

  union all

  select
    'registrations'::text,
    registration.id::text,
    jsonb_build_object(
      'activity_date', registration.activity_date,
      'guests', registration.guests,
      'cancelled_members', registration.cancelled_members,
      'cancelled_guests', registration.cancelled_guests,
      'leave_dates', to_jsonb(registration.leave_dates),
      'leave_times', registration.leave_times,
      'rejoin_times', registration.rejoin_times
    )
  from public.registrations as registration
)
select
  'legacy_archive_mismatch'::text as issue_type,
  expected.source_table,
  expected.source_id,
  jsonb_build_object('expected', expected.payload, 'archived', archive.payload) as details
from expected
left join public.normalization_legacy_collection_archives as archive
  on archive.source_table = expected.source_table
 and archive.source_id = expected.source_id
where archive.payload is distinct from expected.payload

union all

select
  'legacy_archive_orphan'::text,
  archive.source_table,
  archive.source_id,
  jsonb_build_object('archived', archive.payload)
from public.normalization_legacy_collection_archives as archive
left join expected
  on expected.source_table = archive.source_table
 and expected.source_id = archive.source_id
where expected.source_id is null

order by issue_type, source_table, source_id;
