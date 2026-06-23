-- Remove the single_capacity hard block from the capacity-enforcement trigger.
-- single_capacity is a display-only threshold: registrations beyond it are shown
-- as 候補 on the frontend. The trigger should not prevent them from being saved.
-- Only season_capacity (the enrollment ceiling for season members) is a hard limit.

create or replace function public.registration_enforce_capacity()
returns trigger
language plpgsql
as $$
declare
  activity_row public.activities;
  excluded_id uuid;
  capacity integer;
  total_people integer;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  select *
  into activity_row
  from public.activities
  where id = new.activity_id
  for update;

  if not found then
    raise exception 'activity_not_found' using errcode = 'P0001';
  end if;

  excluded_id := case when tg_op = 'UPDATE' then old.id else null end;

  -- Only enforce the season enrollment ceiling (season_capacity).
  -- single_capacity is for display only (正取 vs 候補), not a write barrier.
  if new.activity_date is null then
    capacity := public.registration_season_capacity(activity_row);
    if capacity is not null and capacity > 0 then
      select coalesce(sum(public.registration_people_count(r.self_count, r.guest_count)), 0)::integer
      into total_people
      from public.registrations r
      where r.activity_id = new.activity_id
        and r.activity_date is null
        and r.status = 'active'
        and (excluded_id is null or r.id <> excluded_id);

      total_people := total_people + public.registration_people_count(new.self_count, new.guest_count);
      if total_people > capacity then
        raise exception 'season_capacity_exceeded' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;
