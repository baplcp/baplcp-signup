-- Guest data is now read and written only through its normalized columns.
-- The prior JSON snapshot was kept for the normalization handoff and is no
-- longer part of the application contract.
-- `cancelled_guests` was retired with the old registration JSON and is not
-- read by the current application. Its original values are retained in the
-- legacy collection archive created before that JSON was removed.
delete from public.registration_cancellation_events
where legacy_source = 'cancelled_guests';

alter table public.registration_cancellation_events
  rename column legacy_position to position;

-- Keep the current RPC responses unchanged while removing their obsolete
-- source discriminator. Reuse the deployed definitions so this migration does
-- not duplicate their large response payloads.
do $$
declare
  definition text;
begin
  foreach definition in array array[
    pg_get_functiondef('public.get_activity_page(bigint, bigint)'::regprocedure),
    pg_get_functiondef('public.get_activity_registration(uuid)'::regprocedure)
  ] loop
    definition := replace(definition, 'cancellation.legacy_position', 'cancellation.position');
    definition := replace(definition, ' and cancellation.legacy_source = ''cancelled_members''', '');
    execute definition;
  end loop;
end;
$$;

create or replace function public.write_registration_v3(
  p_registration_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target_registration_id uuid;
  target_activity_id bigint;
  target_activity_date_id bigint;
  target_member_id uuid;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;
  if p_payload ? 'guests' and jsonb_typeof(p_payload -> 'guests') <> 'array' then
    raise exception 'invalid_guests' using errcode = '22023';
  end if;
  if p_payload ? 'cancelled_members' and jsonb_typeof(p_payload -> 'cancelled_members') <> 'array' then
    raise exception 'invalid_cancelled_members' using errcode = '22023';
  end if;

  if p_registration_id is null then
    target_activity_id := (p_payload ->> 'activity_id')::bigint;
    target_activity_date_id := nullif(p_payload ->> 'activity_date_id', '')::bigint;
    target_member_id := nullif(p_payload ->> 'member_id', '')::uuid;
  else
    select registration.activity_id,
           case when p_payload ? 'activity_date_id' then nullif(p_payload ->> 'activity_date_id', '')::bigint else registration.activity_date_id end,
           case when p_payload ? 'member_id' then nullif(p_payload ->> 'member_id', '')::uuid else registration.member_id end
    into target_activity_id, target_activity_date_id, target_member_id
    from public.registrations as registration
    where registration.id = p_registration_id;
    if target_activity_id is null then
      raise exception 'registration_not_found' using errcode = 'P0002';
    end if;
    if p_payload ? 'activity_id' then
      target_activity_id := (p_payload ->> 'activity_id')::bigint;
    end if;
  end if;

  if target_activity_id is null then
    raise exception 'invalid_activity_id' using errcode = '22023';
  end if;
  if target_member_id is null or not exists (select 1 from public.members where id = target_member_id) then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if target_activity_date_id is not null and not exists (
    select 1 from public.activity_dates as activity_date
    where activity_date.id = target_activity_date_id
      and activity_date.activity_id = target_activity_id
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  if p_registration_id is null then
    insert into public.registrations (
      activity_id, activity_date_id, member_id,
      self_count, self_added_at, guest_count, status, paid_court, paid_ac, season_plan
    ) values (
      target_activity_id, target_activity_date_id, target_member_id,
      coalesce((p_payload ->> 'self_count')::integer, 0),
      public.normalization_safe_timestamptz(p_payload ->> 'self_added_at'),
      case when p_payload ? 'guests' then jsonb_array_length(p_payload -> 'guests') else 0 end,
      coalesce(p_payload ->> 'status', 'active'),
      coalesce((p_payload ->> 'paid_court')::boolean, false),
      coalesce((p_payload ->> 'paid_ac')::boolean, false),
      coalesce(p_payload ->> 'season_plan', 'quarter')
    )
    returning id into target_registration_id;
  else
    update public.registrations as registration
    set activity_id = target_activity_id,
        activity_date_id = target_activity_date_id,
        member_id = target_member_id,
        self_count = case when p_payload ? 'self_count' then (p_payload ->> 'self_count')::integer else registration.self_count end,
        self_added_at = case when p_payload ? 'self_added_at' then public.normalization_safe_timestamptz(p_payload ->> 'self_added_at') else registration.self_added_at end,
        guest_count = case when p_payload ? 'guests' then jsonb_array_length(p_payload -> 'guests') else registration.guest_count end,
        status = case when p_payload ? 'status' then p_payload ->> 'status' else registration.status end,
        paid_court = case when p_payload ? 'paid_court' then (p_payload ->> 'paid_court')::boolean else registration.paid_court end,
        paid_ac = case when p_payload ? 'paid_ac' then (p_payload ->> 'paid_ac')::boolean else registration.paid_ac end,
        season_plan = case when p_payload ? 'season_plan' then p_payload ->> 'season_plan' else registration.season_plan end
    where registration.id = p_registration_id
    returning registration.id into target_registration_id;
  end if;

  if p_payload ? 'guests' then
    delete from public.registration_guests where registration_id = target_registration_id;
    insert into public.registration_guests (
      registration_id, guest_position, display_name, gender, joined_at, paid_court, paid_ac
    )
    select
      target_registration_id,
      item.ordinality::integer - 1,
      nullif(btrim(item.value ->> 'name'), ''),
      case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end,
      public.normalization_safe_timestamptz(item.value ->> 'added_at'),
      case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end,
      case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end
    from jsonb_array_elements(p_payload -> 'guests') with ordinality as item(value, ordinality);
  end if;

  if p_payload ? 'cancelled_members' then
    delete from public.registration_cancellation_events
    where registration_id = target_registration_id;
    insert into public.registration_cancellation_events (
      registration_id, position, participant_type,
      member_id, guest_display_name, participant_added_at
    )
    select
      target_registration_id,
      item.ordinality::integer - 1,
      case when item.value ? 'addedBy' then 'guest' else 'self' end,
      target_member_id,
      case when item.value ? 'addedBy' then nullif(btrim(item.value ->> 'name'), '') else null end,
      public.normalization_safe_timestamptz(item.value ->> 'time')
    from jsonb_array_elements(p_payload -> 'cancelled_members') with ordinality as item(value, ordinality);
  end if;

  return target_registration_id;
end;
$$;

alter table public.registration_cancellation_events
  drop constraint registration_cancellation_events_source_unique,
  drop constraint registration_cancellation_events_source_check,
  drop column legacy_source;

alter table public.registration_cancellation_events
  add constraint registration_cancellation_events_position_unique unique (registration_id, position);

alter table public.registration_guests
  drop column legacy_payload;

alter table public.registration_cancellation_events
  drop column recorded_at;
