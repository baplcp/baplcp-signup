-- Keep duplicated guest_count derived from guests so capacity and list summaries
-- cannot drift when a write path updates one field without the other.

create or replace function public.registration_guest_count_from_guests(guests_value jsonb)
returns integer
language sql
immutable
as $$
  select case
    when jsonb_typeof(coalesce(guests_value, '[]'::jsonb)) = 'array'
      then jsonb_array_length(coalesce(guests_value, '[]'::jsonb))
    else 0
  end;
$$;

create or replace function public.registration_sync_guest_count()
returns trigger
language plpgsql
as $$
begin
  new.guest_count := public.registration_guest_count_from_guests(to_jsonb(new.guests));
  return new;
end;
$$;

update public.registrations
set guest_count = public.registration_guest_count_from_guests(to_jsonb(guests))
where guest_count is distinct from public.registration_guest_count_from_guests(to_jsonb(guests));

drop trigger if exists aaa_registrations_sync_guest_count on public.registrations;

create trigger aaa_registrations_sync_guest_count
before insert or update
on public.registrations
for each row
execute function public.registration_sync_guest_count();

drop trigger if exists registrations_enforce_capacity on public.registrations;

create trigger registrations_enforce_capacity
before insert or update of activity_id, activity_date, status, self_count, guest_count, guests, leave_dates
on public.registrations
for each row
execute function public.registration_enforce_capacity();
