-- Date removals are explicit IDs so the write can delete their participation
-- records before deleting the date row. This avoids a pickup registration being
-- converted into a season registration by its ON DELETE SET NULL foreign key.

create or replace function public.write_activity_v5(
  p_activity_id bigint,
  p_payload jsonb
)
returns public.seasons
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  removed_activity_date_ids bigint[];
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_activity_payload' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_payload -> 'removed_activity_date_ids', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_activity_date_ids' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_payload -> 'removed_activity_date_ids', '[]'::jsonb)) as removed_id(value)
    where removed_id.value !~ '^[1-9][0-9]*$'
      or length(removed_id.value) > 18
  ) then
    raise exception 'invalid_activity_date_ids' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct removed_id.value::bigint), '{}'::bigint[])
    into removed_activity_date_ids
  from jsonb_array_elements_text(coalesce(p_payload -> 'removed_activity_date_ids', '[]'::jsonb)) as removed_id(value);

  if p_activity_id is not null and cardinality(removed_activity_date_ids) > 0 then
    perform 1
    from public.seasons as season
    where season.id = p_activity_id
    for update;

    if not found then
      raise exception 'activity_not_found' using errcode = 'P0002';
    end if;

    if exists (
      select 1
      from unnest(removed_activity_date_ids) as removed_id(id)
      where not exists (
        select 1
        from public.activity_dates as activity_date
        where activity_date.id = removed_id.id
          and activity_date.season_id = p_activity_id
      )
    ) then
      raise exception 'invalid_activity_date_ids' using errcode = '22023';
    end if;

    delete from public.season_registration_date_statuses
    where activity_date_id = any(removed_activity_date_ids);

    delete from public.registration_guests
    where season_id = p_activity_id
      and activity_date_id = any(removed_activity_date_ids);

    delete from public.registrations
    where season_id = p_activity_id
      and activity_date_id = any(removed_activity_date_ids);

    delete from public.activity_dates
    where season_id = p_activity_id
      and id = any(removed_activity_date_ids);
  end if;

  return public.write_activity_v3(p_activity_id, p_payload);
end;
$$;

create or replace function public.write_activity_v4(
  p_activity_id bigint,
  p_organizer_user_id text,
  p_payload jsonb
)
returns public.seasons
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.members as member
    where member.user_id = p_organizer_user_id
      and member.role = 'organizer'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return public.write_activity_v5(p_activity_id, p_payload);
end;
$$;

revoke all on function public.write_activity_v5(bigint, jsonb) from public;
grant execute on function public.write_activity_v5(bigint, jsonb) to service_role;
revoke all on function public.write_activity_v4(bigint, text, jsonb) from public;
grant execute on function public.write_activity_v4(bigint, text, jsonb) to service_role;
