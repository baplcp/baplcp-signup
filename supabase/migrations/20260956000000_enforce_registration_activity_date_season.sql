-- A pickup registration belongs to one concrete activity date within its own
-- season.  The old FK used ON DELETE SET NULL, which could turn a pickup row
-- into a row that looks like a season registration when a date was deleted
-- outside write_activity_v5.

do $$
declare
  invalid_registration_count integer;
begin
  select count(*)::integer
    into invalid_registration_count
  from public.registrations as registration
  left join public.activity_dates as activity_date
    on activity_date.id = registration.activity_date_id
  where registration.season_id is null
    or (
      registration.activity_date_id is not null
      and activity_date.season_id is distinct from registration.season_id
    );

  if invalid_registration_count > 0 then
    raise exception 'registration_activity_date_season_integrity_failed: % invalid registrations', invalid_registration_count;
  end if;
end;
$$;

-- Every application write already supplies a season.  Making this explicit is
-- required so the composite FK cannot be bypassed by a NULL season_id.
alter table public.registrations
  alter column season_id set not null;

-- A foreign key may reference a non-partial unique index.  id is already the
-- primary key, but this pair lets PostgreSQL enforce that both references name
-- the same season.
create unique index if not exists activity_dates_id_season_id_unique
  on public.activity_dates (id, season_id);

alter table public.registrations
  drop constraint if exists registrations_activity_date_id_fkey,
  add constraint registrations_activity_date_season_fkey
    foreign key (activity_date_id, season_id)
    references public.activity_dates (id, season_id)
    on delete cascade;

comment on constraint registrations_activity_date_season_fkey on public.registrations is
  'A pickup date must belong to the registration season. Deleting that date removes its pickup registrations instead of converting them into season registrations.';
