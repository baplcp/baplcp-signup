-- Phase 3: move registration integrity rules onto normalized collections.
-- Legacy JSON writers remain supported until the compatibility period ends.

create or replace function public.registration_guest_count_from_normalized(
  p_registration_id uuid
)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.registration_guests
  where registration_id = p_registration_id;
$$;

create or replace function public.normalization_guest_count_sync_in_progress()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.normalized_guest_count_sync', true), '') = 'on';
$$;

do $$
begin
  if exists (
    select 1
    from public.registrations as registration
    where registration.guest_count is distinct from (
      select count(*)::integer
      from public.registration_guests as guest
      where guest.registration_id = registration.id
    )
  ) then
    raise exception 'registration_guest_count_mismatch: run check-normalized-collections.sql and resolve the reported rows before applying this migration';
  end if;
end;
$$;

create or replace function public.registration_sync_guest_count_from_normalized()
returns trigger
language plpgsql
as $$
declare
  target_registration_id uuid;
begin
  target_registration_id := case
    when tg_op = 'DELETE' then old.registration_id
    else new.registration_id
  end;

  perform set_config('app.normalized_guest_count_sync', 'on', true);

  update public.registrations
  set guest_count = public.registration_guest_count_from_normalized(target_registration_id)
  where id = target_registration_id
    and guest_count is distinct from public.registration_guest_count_from_normalized(target_registration_id);

  perform set_config('app.normalized_guest_count_sync', 'off', true);

  return null;
end;
$$;

drop trigger if exists registration_guests_sync_guest_count on public.registration_guests;
create trigger registration_guests_sync_guest_count
after insert or update or delete on public.registration_guests
for each row
execute function public.registration_sync_guest_count_from_normalized();

-- Older writers still submit registrations.guests. Their before trigger keeps
-- working, but canonical RPC writes set this flag and are counted from child
-- rows instead of the compatibility snapshot.
drop trigger if exists aaa_registrations_sync_guest_count on public.registrations;
create trigger aaa_registrations_sync_guest_count
before insert or update on public.registrations
for each row
when (
  not public.normalization_write_in_progress()
  and not public.normalization_guest_count_sync_in_progress()
)
execute function public.registration_sync_guest_count();

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

  -- single_capacity remains a display-only threshold. Only season capacity is
  -- enforced. Existing registrations are counted from registration_guests,
  -- not their legacy guests JSONB snapshot.
  if new.activity_date is null then
    capacity := public.registration_season_capacity(activity_row);
    if capacity is not null and capacity > 0 then
      select coalesce(
        sum(
          greatest(coalesce(registration.self_count, 0), 0)
          + public.registration_guest_count_from_normalized(registration.id)
        ),
        0
      )::integer
      into total_people
      from public.registrations as registration
      where registration.activity_id = new.activity_id
        and registration.activity_date is null
        and registration.status = 'active'
        and (excluded_id is null or registration.id <> excluded_id);

      total_people := total_people
        + greatest(coalesce(new.self_count, 0), 0)
        + greatest(coalesce(new.guest_count, 0), 0);
      if total_people > capacity then
        raise exception 'season_capacity_exceeded' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_enforce_capacity on public.registrations;
create trigger registrations_enforce_capacity
before insert or update of activity_id, activity_date, activity_date_id, status, self_count, guest_count, guests on public.registrations
for each row
execute function public.registration_enforce_capacity();

-- This index covers canonical pickup lookup and uniqueness. Keep the legacy
-- text-date index until all fallback writers and compatibility columns retire.
create unique index if not exists registrations_active_pickup_activity_date_user_unique
on public.registrations (activity_id, activity_date_id, user_id)
where status = 'active' and activity_date_id is not null;
