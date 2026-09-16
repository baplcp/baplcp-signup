# Supabase Schema Contract

This file documents the database contract used by the app and the Edge
Functions. Structural changes and policy changes should be added as SQL files
under `supabase/migrations/`.

## Security Model

- Browser clients use the anon key for reads only.
- Writes to `activities`, `registrations`, and `members` are blocked for
  `anon` and `authenticated` roles.
- Write operations go through Edge Functions using the service role key:
  - `activity-admin`: organizer-only activity create/update/delete.
  - `registration-action`: LINE-verified registration changes and organizer
    registration administration.
  - `member-profile`: LINE-verified member sync and profile updates.
- Public read RLS policies are versioned in
  `20260520005000_version_public_rls_policies.sql`.

## Normalized-write Rollout

After v3 `activity-admin` and `registration-action` Edge Functions have passed
production validation, deploy
`20260918000000_retire_legacy_collection_columns.sql`. It verifies archive
coverage before removing the old collection columns, fallback triggers, and v2
RPCs. Historical raw values remain in
`normalization_legacy_collection_archives`.

## Local Dev Admin

When serving Edge Functions locally, admin actions can use a local dev identity
instead of a LINE access token. Set these only in the local function env file:

```env
ALLOW_DEV_ADMIN=true
```

The dev bypass is limited to localhost origins and does not check
`members.role`. LINE-token requests still require `role = organizer` for
admin operations.

## Tables

### `activities`

Primary key:

- `id bigint`

Fields used by the app:

- `game_type text`
- `title text`
- `location text`
- `start_time time/text`
- `end_time time/text`
- `season_fee_per_session numeric`
- `season_half_year_fee_per_session numeric`
- `pickup_fee_per_session numeric`
- `ac_fee numeric`
- `single_capacity integer`
- `season_enabled boolean`
- `season_include_ac boolean`
- `season_total_fee numeric`
- `season_half_year_total_fee numeric`
- `season_capacity text`
- `season_open_date date/text`
- `season_open_time time/text`
- `season_deadline_type text`
- `season_close_date date/text`
- `season_close_time time/text`
- `pickup_label text`
- `pickup_open_days_before integer`
- `pickup_open_time time/text`
- `pickup_deadline_type text`
- `pickup_close_days_before integer`
- `pickup_close_time time/text`
- `reminder_enabled boolean`
- `reminder_days_before integer`
- `reminder_time time/text`
- `ac_enabled boolean`
- `created_at timestamptz`

Normalized tables:

- `activity_dates` is the canonical table for activity dates. It keeps an
  active flag rather than deleting retired dates, so historical registrations
  and attendance states retain their references.

### `registrations`

Primary key:

- `id uuid`

Fields used by the app:

- `activity_id bigint`
- `user_id text`
- `display_name text`
- `picture_url text`
- `self_count integer`
- `self_added_at timestamptz`
- `guest_count integer, derived from registration_guests by trigger`
- `status text`
- `paid_court boolean`
- `paid_ac boolean`
- `season_plan text` — `'quarter'` (一季) or `'half-year'` (半年), only meaningful for season registrations
- `activity_date_id bigint, nullable` — canonical pickup reference. A null
  value identifies a season registration.
- `created_at timestamptz`

Database invariants:

- One active pickup registration per `(activity_id, activity_date_id, user_id)`.
- One active season registration per `(activity_id, user_id)` where
  `activity_date_id is null`.
- Capacity checks run in a trigger that locks the related activity row.
- `guest_count` is a cached count of `registration_guests`.

Normalized tables:

- `registration_guests` is the canonical per-guest data, including guest
  payment state. `write_registration_v3` writes this representation.
- `season_registration_date_statuses` is the canonical season-member
  leave/rejoin state per activity date.
- `registration_cancellation_events` stores cancelled-member history. Its
  `legacy_payload` preserves the original event JSON object.
- These normalized tables have RLS enabled. Browser roles can read them under
  the same public-read model as their parent records; only `service_role` can
  execute the normalized-write RPCs.
- Browser read services and scheduled notification functions query the
  normalized tables. `normalization_legacy_collection_archives` has no browser
  read policy and preserves the pre-retirement raw values for recovery.

### `members`

Primary key:

- `id uuid`

Fields used by the app:

- `user_id text unique`
- `role text`
- `display_name text`
- `gender text`
- `is_season boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

Roles:

- `organizer`
- `engineer`
- `member`

## Migration Index

- `20260520000000_lock_member_registration_writes.sql`: blocks direct anon
  writes to `members` and `registrations`.
- `20260520001000_lock_activity_writes.sql`: blocks direct anon writes to
  `activities`.
- `20260520002000_enforce_registration_consistency.sql`: unique active
  registration indexes and capacity trigger.
- `20260520003000_persist_partial_cancellations.sql`: persisted partial
  cancellation snapshots.
- `20260520004000_sync_guest_count_with_guests.sql`: derives `guest_count`
  from `guests`.
- `20260520005000_version_public_rls_policies.sql`: RLS read policies and
  write revokes.
- `20260605000000_restrict_public_member_registration_reads.sql`: introduced
  temporary narrow public read views for member and registration data.
- `20260605001000_restore_public_member_registration_reads.sql`: restores
  base-table public reads after removing the public view mode.
- `20260623002000_add_season_plan_to_registrations.sql`: adds `season_plan`
  column to `registrations` for recording whether a season member chose 一季 or 半年.
- `20260623003000_add_leave_times_to_registrations.sql`: adds `leave_times`
  column to `registrations` to record the ISO timestamp when each season leave was submitted.
- `20260623004000_add_member_pickup_summary_view.sql`: creates `member_pickup_summary`
  view that aggregates pickup registration dates and count per member per activity.
- `20260827000000_normalize_activity_registration_collections.sql`: adds
  normalized activity-date, guest, attendance-state, and cancellation-event
  tables; backfills legacy data without deleting source columns; and keeps the
  two representations synchronized during the application cutover.
- `20260827001000_allow_normalized_public_reads.sql`: grants browser read
  policies on normalized tables that mirror the existing public base-table read
  model; writes remain restricted to Edge Functions.
- `20260907000000_add_normalized_write_rpcs.sql`: introduces service-role-only
  RPCs that write normalized data as the canonical representation and update
  legacy columns in the same transaction. Legacy writers remain supported
  during Edge Function deployment through trigger guards.
- `20260916000000_normalize_registration_integrity_rules.sql`: derives
  `guest_count` from `registration_guests` for canonical writes, counts season
  capacity from normalized guests, and adds the canonical pickup uniqueness
  index while retaining legacy trigger and index fallbacks.
- `20260917000000_prepare_legacy_collection_retirement.sql`: archives legacy
  collection values, introduces normalized-only v3 write RPCs, and switches
  registration identity and season capacity rules to `activity_date_id`.
- `20260918000000_retire_legacy_collection_columns.sql`: verifies archive
  coverage, then removes legacy collection columns, fallback triggers, old
  indexes, and v2 RPCs.
- `20260919000000_drop_member_pickup_summary_view.sql`: removes the unused
  `member_pickup_summary` reporting view.
- `20260920000000_authorize_activity_writes_in_rpc.sql`: moves organizer
  authorization for activity create, update, and delete into service-role-only
  RPCs so each production action uses one database request.
- `20260921000000_authorize_activity_ac_update_in_rpc.sql`: moves organizer
  authorization for the admin AC toggle into a service-role-only RPC.
