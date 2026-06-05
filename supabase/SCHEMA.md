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
- Public browser reads for sensitive member and registration data go through
  narrow views instead of full base-table access:
  - `public_registrations`
  - `public_member_genders`

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
- `dates array/json-compatible date list`
- `start_time time/text`
- `end_time time/text`
- `season_fee_per_session numeric`
- `pickup_fee_per_session numeric`
- `ac_fee numeric`
- `single_capacity integer`
- `season_enabled boolean`
- `season_include_ac boolean`
- `season_total_fee numeric`
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

### `registrations`

Primary key:

- `id uuid`

Fields used by the app:

- `activity_id bigint`
- `activity_date date/text, nullable for season registrations`
- `user_id text`
- `display_name text`
- `picture_url text`
- `self_count integer`
- `self_added_at timestamptz`
- `guest_count integer, derived from guests by trigger`
- `guests json/jsonb array`
- `status text`
- `paid_court boolean`
- `paid_ac boolean`
- `leave_dates json/jsonb array`
- `rejoin_times json/jsonb object`
- `cancelled_members jsonb array`
- `created_at timestamptz`

Database invariants:

- One active pickup registration per `(activity_id, activity_date, user_id)`.
- One active season registration per `(activity_id, user_id)` where
  `activity_date is null`.
- Capacity checks run in a trigger that locks the related activity row.
- `guest_count` is synchronized from `guests` by trigger.

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

### Public read views

#### `public_registrations`

Browser-readable registration fields used by the list UI. The base
`registrations` table is no longer publicly selectable beyond a minimal
observable surface for realtime change notifications.

Fields:

- `id`
- `activity_id`
- `activity_date`
- `user_id`
- `display_name`
- `picture_url`
- `self_count`
- `self_added_at`
- `guest_count`
- `guests`
- `status`
- `leave_dates`
- `rejoin_times`
- `cancelled_members`
- `created_at`

Payment fields are intentionally excluded from this public view. Logged-in
members can fetch only their own payment state through
`registration-action:list-registration-payments`; organizers can fetch payment
state for the whole activity through the same Edge Function action.

#### `public_member_genders`

Browser-readable member gender lookup used by the list UI. Only members that
appear in registration records are included.

Fields:

- `user_id`
- `gender`

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
- `20260605000000_restrict_public_member_registration_reads.sql`: narrows
  public reads for `members` and `registrations` to public views and keeps only
  minimal registration columns observable for realtime notifications.
