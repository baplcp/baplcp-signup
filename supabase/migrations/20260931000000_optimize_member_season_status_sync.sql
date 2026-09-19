-- Pickup registrations cannot affect season membership. For season changes,
-- update the cached member flag only when its value actually changes.
create or replace function public.sync_member_season_status_from_registrations()
returns trigger
language plpgsql
as $$
declare
  affected_user_ids text[] := array[]::text[];
begin
  if tg_op = 'UPDATE'
    and old.user_id is not distinct from new.user_id
    and old.activity_date_id is not distinct from new.activity_date_id
    and old.status is not distinct from new.status then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.activity_date_id is null and old.user_id is not null then
    affected_user_ids := array_append(affected_user_ids, old.user_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.activity_date_id is null and new.user_id is not null then
    affected_user_ids := array_append(affected_user_ids, new.user_id);
  end if;

  if cardinality(affected_user_ids) = 0 then
    return null;
  end if;

  update public.members as member
  set is_season = exists (
    select 1
    from public.registrations as registration
    where registration.user_id = member.user_id
      and registration.activity_date_id is null
      and registration.status = 'active'
  )
  where member.user_id = any(affected_user_ids)
    and member.is_season is distinct from exists (
      select 1
      from public.registrations as registration
      where registration.user_id = member.user_id
        and registration.activity_date_id is null
        and registration.status = 'active'
    );

  return null;
end;
$$;
