-- `single_capacity` determines the boundary between confirmed and waitlisted
-- players.  It must not reject a pickup signup: the member-list UI assigns
-- waitlist status from the same chronological participant order.
--
-- Season enrollment capacity remains a hard limit because it controls whether
-- a member can join a season plan at all.

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
  target_season_id bigint;
  target_activity_date_id bigint;
  target_member_id uuid;
  target_season_plan text;
  capacity integer;
  occupied_total integer;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;

  if p_registration_id is null then
    target_season_id := (p_payload ->> 'season_id')::bigint;
    target_activity_date_id := nullif(p_payload ->> 'activity_date_id', '')::bigint;
    target_member_id := nullif(p_payload ->> 'member_id', '')::uuid;
  else
    select season_id, activity_date_id, member_id
      into target_season_id, target_activity_date_id, target_member_id
      from public.registrations
      where id = p_registration_id;
    if target_season_id is null then
      raise exception 'registration_not_found' using errcode = 'P0002';
    end if;
  end if;

  if target_season_id is null or target_member_id is null then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;
  if target_activity_date_id is not null and not exists (
    select 1
    from public.activity_dates
    where id = target_activity_date_id and season_id = target_season_id
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  perform 1 from public.seasons where id = target_season_id for update;

  if p_registration_id is null then
    insert into public.registrations (season_id, activity_date_id, member_id, paid_court, paid_ac, season_plan, cancelled_at)
    values (
      target_season_id, target_activity_date_id, target_member_id,
      coalesce((p_payload ->> 'paid_court')::boolean, false),
      coalesce((p_payload ->> 'paid_ac')::boolean, false),
      coalesce(p_payload ->> 'season_plan', 'quarter'),
      public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at')
    ) returning id, season_plan into target_registration_id, target_season_plan;
  else
    update public.registrations as registration
    set cancelled_at = case when p_payload ? 'cancelled_at' then public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at') else registration.cancelled_at end,
        paid_court = case when p_payload ? 'paid_court' then (p_payload ->> 'paid_court')::boolean else registration.paid_court end,
        paid_ac = case when p_payload ? 'paid_ac' then (p_payload ->> 'paid_ac')::boolean else registration.paid_ac end,
        season_plan = case when p_payload ? 'season_plan' then p_payload ->> 'season_plan' else registration.season_plan end
    where registration.id = p_registration_id
    returning registration.id, registration.season_plan into target_registration_id, target_season_plan;
  end if;

  if target_activity_date_id is null then
    select case
      when nullif(btrim(season_capacity::text), '') is null then null
      when lower(season_capacity::text) = 'unlimited' then null
      when season_capacity::text ~ '^\d+$' then season_capacity::integer
      else null
    end into capacity
    from public.seasons
    where id = target_season_id;

    if capacity is not null and capacity > 0 then
      select count(*)::integer into occupied_total
      from public.registrations
      where season_id = target_season_id
        and activity_date_id is null
        and cancelled_at is null
        and public.season_plans_overlap(season_plan, target_season_plan);
      if occupied_total > capacity then
        raise exception 'season_capacity_exceeded' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return target_registration_id;
end;
$$;

create or replace function public.write_registration_guests_v1(
  p_activity_id bigint,
  p_activity_date_id bigint,
  p_invited_by uuid,
  p_guests jsonb,
  p_invitation_limit integer default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  active_guest_total integer;
begin
  if jsonb_typeof(p_guests) <> 'array' then
    raise exception 'invalid_guests' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.activity_dates
    where id = p_activity_date_id and season_id = p_activity_id
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  perform 1 from public.seasons where id = p_activity_id for update;

  if exists (
    select 1
    from jsonb_array_elements(p_guests) as item(value)
    where nullif(item.value ->> 'id', '') is not null
      and not exists (
        select 1
        from public.registration_guests as guest
        where guest.id = nullif(item.value ->> 'id', '')::uuid
          and guest.season_id = p_activity_id
          and guest.activity_date_id = p_activity_date_id
          and guest.invited_by = p_invited_by
          and guest.cancelled_at is null
      )
  ) then
    raise exception 'guest_not_found' using errcode = 'P0002';
  end if;

  update public.registration_guests as guest
  set cancelled_at = now(), updated_at = now()
  where guest.season_id = p_activity_id
    and guest.activity_date_id = p_activity_date_id
    and guest.invited_by = p_invited_by
    and guest.cancelled_at is null
    and not exists (
      select 1
      from jsonb_array_elements(p_guests) as item(value)
      where nullif(item.value ->> 'id', '')::uuid = guest.id
    );

  update public.registration_guests as guest
  set display_name = nullif(btrim(item.value ->> 'name'), ''),
      gender = case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end,
      paid_court = case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end,
      paid_ac = case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end,
      updated_at = now()
  from jsonb_array_elements(p_guests) as item(value)
  where guest.id = nullif(item.value ->> 'id', '')::uuid
    and guest.cancelled_at is null;

  insert into public.registration_guests (season_id, activity_date_id, invited_by, display_name, gender, paid_court, paid_ac)
  select p_activity_id, p_activity_date_id, p_invited_by,
    nullif(btrim(item.value ->> 'name'), ''),
    case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end,
    case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end,
    case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end
  from jsonb_array_elements(p_guests) as item(value)
  where nullif(item.value ->> 'id', '') is null;

  if p_invitation_limit is not null then
    select count(*)::integer into active_guest_total
    from public.registration_guests
    where season_id = p_activity_id
      and activity_date_id = p_activity_date_id
      and invited_by = p_invited_by
      and cancelled_at is null;
    if active_guest_total > p_invitation_limit then
      raise exception 'guest_invitation_limit_exceeded' using errcode = 'P0001';
    end if;
  end if;
end;
$$;

revoke all on function public.write_registration_v3(uuid, jsonb) from public;
grant execute on function public.write_registration_v3(uuid, jsonb) to service_role;
revoke all on function public.write_registration_guests_v1(bigint, bigint, uuid, jsonb, integer) from public;
grant execute on function public.write_registration_guests_v1(bigint, bigint, uuid, jsonb, integer) to service_role;

comment on function public.write_registration_v3(uuid, jsonb) is
  'Writes a self registration. Season capacity is enforced; pickup capacity determines waitlist order only.';
comment on function public.write_registration_guests_v1(bigint, bigint, uuid, jsonb, integer) is
  'Writes guest registrations. The single-session capacity determines waitlist order only.';
