-- A plan describes a season enrollment, never a single-date pickup.
-- Normalize the historical rows before enforcing that distinction.

update public.registrations
set season_plan = 'quarter'
where activity_date_id is null
  and season_plan is null;

update public.registrations
set season_plan = null
where activity_date_id is not null
  and season_plan is not null;

alter table public.registrations
  alter column season_plan drop default,
  drop constraint if exists registrations_season_plan_check,
  add constraint registrations_season_plan_check check (
    (activity_date_id is null and season_plan is not null and season_plan in ('quarter', 'late-quarter', 'half-year'))
    or (activity_date_id is not null and season_plan is null)
  );

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
      case when target_activity_date_id is null then coalesce(p_payload ->> 'season_plan', 'quarter') else null end,
      public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at')
    ) returning id, season_plan into target_registration_id, target_season_plan;
  else
    update public.registrations as registration
    set cancelled_at = case when p_payload ? 'cancelled_at' then public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at') else registration.cancelled_at end,
        paid_court = case when p_payload ? 'paid_court' then (p_payload ->> 'paid_court')::boolean else registration.paid_court end,
        paid_ac = case when p_payload ? 'paid_ac' then (p_payload ->> 'paid_ac')::boolean else registration.paid_ac end,
        season_plan = case
          when target_activity_date_id is not null then null
          when p_payload ? 'season_plan' then p_payload ->> 'season_plan'
          else registration.season_plan
        end
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

revoke all on function public.write_registration_v3(uuid, jsonb) from public;
grant execute on function public.write_registration_v3(uuid, jsonb) to service_role;

comment on function public.write_registration_v3(uuid, jsonb) is
  'Writes a self registration. season_plan is retained only for season registrations; season capacity is enforced and pickup capacity determines waitlist order only.';
