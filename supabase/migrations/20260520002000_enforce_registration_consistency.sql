-- Prevent duplicate active registrations and reject writes that exceed capacity.
-- The trigger locks the activity row, so concurrent registration writes for the
-- same activity are serialized before capacity is checked.

create unique index if not exists registrations_active_pickup_user_unique
on public.registrations (activity_id, activity_date, user_id)
where status = 'active' and activity_date is not null;

create unique index if not exists registrations_active_season_user_unique
on public.registrations (activity_id, user_id)
where status = 'active' and activity_date is null;

create or replace function public.registration_people_count(self_count_value integer, guest_count_value integer)
returns integer
language sql
immutable
as $$
  select greatest(coalesce(self_count_value, 0), 0) + greatest(coalesce(guest_count_value, 0), 0);
$$;

create or replace function public.registration_season_capacity(activity_row public.activities)
returns integer
language plpgsql
stable
as $$
declare
  capacity_text text;
begin
  capacity_text := nullif(activity_row.season_capacity::text, '');
  if capacity_text is null or lower(capacity_text) = 'unlimited' then
    return null;
  end if;
  if capacity_text !~ '^\d+$' then
    return null;
  end if;
  return capacity_text::integer;
end;
$$;

create or replace function public.registration_pickup_people_count(
  target_activity_id bigint,
  target_activity_date text,
  excluded_registration_id uuid
)
returns integer
language sql
stable
as $$
  select coalesce(sum(public.registration_people_count(r.self_count, r.guest_count)), 0)::integer
  from public.registrations r
  where r.activity_id = target_activity_id
    and r.activity_date::text = target_activity_date
    and r.status = 'active'
    and (excluded_registration_id is null or r.id <> excluded_registration_id);
$$;

create or replace function public.registration_attending_season_people_count(
  target_activity_id bigint,
  target_activity_date text,
  excluded_registration_id uuid
)
returns integer
language sql
stable
as $$
  select coalesce(sum(greatest(coalesce(r.self_count, 0), 0)), 0)::integer
  from public.registrations r
  where r.activity_id = target_activity_id
    and r.activity_date is null
    and r.status = 'active'
    and not (coalesce(to_jsonb(r.leave_dates), '[]'::jsonb) ? target_activity_date)
    and (excluded_registration_id is null or r.id <> excluded_registration_id);
$$;

create or replace function public.registration_enforce_capacity()
returns trigger
language plpgsql
as $$
declare
  activity_row public.activities;
  excluded_id uuid;
  capacity integer;
  total_people integer;
  activity_date_value text;
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

    if coalesce(new.self_count, 0) > 0 and activity_row.single_capacity is not null and activity_row.single_capacity > 0 then
      for activity_date_value in
        select jsonb_array_elements_text(coalesce(to_jsonb(activity_row.dates), '[]'::jsonb))
      loop
        if not (coalesce(to_jsonb(new.leave_dates), '[]'::jsonb) ? activity_date_value) then
          total_people :=
            public.registration_pickup_people_count(new.activity_id, activity_date_value, excluded_id)
            + public.registration_attending_season_people_count(new.activity_id, activity_date_value, excluded_id)
            + greatest(coalesce(new.self_count, 0), 0);

          if total_people > activity_row.single_capacity then
            raise exception 'pickup_capacity_exceeded' using errcode = 'P0001';
          end if;
        end if;
      end loop;
    end if;

    return new;
  end if;

  if activity_row.single_capacity is not null and activity_row.single_capacity > 0 then
    total_people :=
      public.registration_pickup_people_count(new.activity_id, new.activity_date::text, excluded_id)
      + public.registration_attending_season_people_count(new.activity_id, new.activity_date::text, excluded_id)
      + public.registration_people_count(new.self_count, new.guest_count);

    if total_people > activity_row.single_capacity then
      raise exception 'pickup_capacity_exceeded' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_enforce_capacity on public.registrations;

create trigger registrations_enforce_capacity
before insert or update of activity_id, activity_date, status, self_count, guest_count, leave_dates
on public.registrations
for each row
execute function public.registration_enforce_capacity();
