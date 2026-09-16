-- Phase 4b: remove legacy collection storage after v3 application writes have
-- been verified. Historical raw values remain in
-- normalization_legacy_collection_archives.

do $$
begin
  if exists (
    select 1
    from public.activities as activity
    left join public.normalization_legacy_collection_archives as archive
      on archive.source_table = 'activities'
     and archive.source_id = activity.id::text
    where archive.source_id is null
  ) or exists (
    select 1
    from public.registrations as registration
    left join public.normalization_legacy_collection_archives as archive
      on archive.source_table = 'registrations'
     and archive.source_id = registration.id::text
    where archive.source_id is null
  ) then
    raise exception 'legacy_collection_archive_incomplete: run check-legacy-collection-archives.sql and resolve missing snapshots before retiring columns';
  end if;
end;
$$;

drop trigger if exists activities_sync_normalized_sessions on public.activities;
drop trigger if exists activities_archive_legacy_collections on public.activities;
drop trigger if exists registrations_set_activity_date_reference on public.registrations;
drop trigger if exists registrations_sync_normalized_guests on public.registrations;
drop trigger if exists registrations_sync_normalized_cancellations on public.registrations;
drop trigger if exists registrations_sync_normalized_session_statuses on public.registrations;
drop trigger if exists registrations_archive_legacy_collections on public.registrations;
drop trigger if exists aaa_registrations_sync_guest_count on public.registrations;

drop function if exists public.write_activity_v2(bigint, jsonb);
drop function if exists public.write_registration_v2(uuid, jsonb);
drop function if exists public.set_season_registration_date_status_v2(uuid, text, boolean, timestamptz);
drop function if exists public.sync_activity_dates_from_legacy_dates();
drop function if exists public.sync_registration_guests_from_legacy_json();
drop function if exists public.sync_registration_cancellation_events_from_legacy_json();
drop function if exists public.sync_registration_activity_date_reference();
drop function if exists public.sync_season_registration_date_statuses_from_legacy();
drop function if exists public.archive_legacy_activity_collections();
drop function if exists public.archive_legacy_registration_collections();
drop function if exists public.registration_sync_guest_count();
drop function if exists public.registration_guest_count_from_guests(jsonb);
drop function if exists public.normalization_guest_count_sync_in_progress();
drop function if exists public.normalization_write_in_progress();
drop function if exists public.normalization_jsonb_array(jsonb);
drop function if exists public.normalization_jsonb_object(jsonb);
drop function if exists public.sync_season_member();
drop function if exists public.unsync_season_member();

drop index if exists public.registrations_active_pickup_user_unique;

drop trigger if exists registrations_enforce_capacity on public.registrations;
create trigger registrations_enforce_capacity
before insert or update of activity_id, activity_date_id, status, self_count, guest_count
on public.registrations
for each row
execute function public.registration_enforce_capacity();

alter table public.activities
  drop column dates;

alter table public.registrations
  drop column activity_date,
  drop column guests,
  drop column cancelled_members,
  drop column cancelled_guests,
  drop column leave_dates,
  drop column leave_times,
  drop column rejoin_times;

comment on table public.activity_dates is
  'Canonical activity dates. Historical legacy activity date snapshots are retained in normalization_legacy_collection_archives.';
comment on table public.registration_guests is
  'Canonical per-guest data. Historical legacy registration snapshots are retained in normalization_legacy_collection_archives.';
comment on table public.season_registration_date_statuses is
  'Canonical per-activity-date leave/rejoin state for season registrations.';
