-- A leave/rejoin state is meaningful only for a date covered by that season
-- registration's plan.  Detect historical violations before guarding all
-- future writes through the canonical RPC.

do $$
declare
  invalid_status_count integer;
begin
  select count(*)::integer
    into invalid_status_count
  from public.season_registration_date_statuses as date_status
  join public.registrations as registration
    on registration.id = date_status.registration_id
  join public.activity_dates as activity_date
    on activity_date.id = date_status.activity_date_id
  where registration.activity_date_id is not null
    or activity_date.season_id is distinct from registration.season_id
    or not coalesce(
      public.season_plan_covers_date(
        registration.season_plan,
        activity_date.activity_date,
        public.activity_season_quarter_cutoff(registration.season_id)
      ),
      false
    );

  if invalid_status_count > 0 then
    raise exception 'season_registration_date_status_plan_integrity_failed: % invalid statuses', invalid_status_count;
  end if;
end;
$$;

create or replace function public.set_season_registration_date_status_v3(
  p_registration_id uuid,
  p_activity_date_id bigint,
  p_is_on_leave boolean,
  p_changed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.registrations as registration
    join public.activity_dates as activity_date
      on activity_date.id = p_activity_date_id
     and activity_date.season_id = registration.season_id
    where registration.id = p_registration_id
      and registration.activity_date_id is null
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.registrations as registration
    join public.activity_dates as activity_date
      on activity_date.id = p_activity_date_id
     and activity_date.season_id = registration.season_id
    where registration.id = p_registration_id
      and registration.activity_date_id is null
      and public.season_plan_covers_date(
        registration.season_plan,
        activity_date.activity_date,
        public.activity_season_quarter_cutoff(registration.season_id)
      )
  ) then
    raise exception 'season_plan_not_covering_date' using errcode = 'P0001';
  end if;

  insert into public.season_registration_date_statuses (
    registration_id, activity_date_id, is_on_leave, leave_submitted_at, rejoined_at
  ) values (
    p_registration_id,
    p_activity_date_id,
    p_is_on_leave,
    case when p_is_on_leave then p_changed_at else null end,
    case when p_is_on_leave then null else p_changed_at end
  )
  on conflict (registration_id, activity_date_id) do update
  set is_on_leave = excluded.is_on_leave,
      leave_submitted_at = case when excluded.is_on_leave then excluded.leave_submitted_at else season_registration_date_statuses.leave_submitted_at end,
      rejoined_at = case when excluded.is_on_leave then season_registration_date_statuses.rejoined_at else excluded.rejoined_at end,
      updated_at = now();
end;
$$;

revoke all on function public.set_season_registration_date_status_v3(uuid, bigint, boolean, timestamptz) from public;
grant execute on function public.set_season_registration_date_status_v3(uuid, bigint, boolean, timestamptz) to service_role;

comment on function public.set_season_registration_date_status_v3(uuid, bigint, boolean, timestamptz) is
  'Writes a season leave or rejoin state only when the activity date belongs to the registration season and is covered by its plan.';
