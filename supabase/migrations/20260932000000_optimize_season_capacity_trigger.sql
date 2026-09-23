-- Capacity is enforced only for active season registrations. Pickup writes do
-- not consume season capacity and must not serialize on the activity row.
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
  if new.status is distinct from 'active' or new.activity_date_id is not null then
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
  capacity := public.registration_season_capacity(activity_row);
  if capacity is null or capacity <= 0 then
    return new;
  end if;

  -- guest_count is maintained by registration_guests_sync_guest_count, so
  -- this aggregate avoids one child-table count per existing registration.
  select coalesce(
    sum(
      greatest(coalesce(registration.self_count, 0), 0)
      + greatest(coalesce(registration.guest_count, 0), 0)
    ),
    0
  )::integer
  into total_people
  from public.registrations as registration
  where registration.activity_id = new.activity_id
    and registration.activity_date_id is null
    and registration.status = 'active'
    and (excluded_id is null or registration.id <> excluded_id);

  total_people := total_people
    + greatest(coalesce(new.self_count, 0), 0)
    + greatest(coalesce(new.guest_count, 0), 0);
  if total_people > capacity then
    raise exception 'season_capacity_exceeded' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
