-- Activity dates are permanently deleted with their related participation
-- data. They no longer have a retired/inactive state.

delete from public.season_registration_date_statuses as status
using public.activity_dates as activity_date
where status.activity_date_id = activity_date.id
  and not activity_date.is_active;

delete from public.registration_guests as guest
using public.activity_dates as activity_date
where guest.activity_date_id = activity_date.id
  and not activity_date.is_active;

delete from public.registrations as registration
using public.activity_dates as activity_date
where registration.activity_date_id = activity_date.id
  and not activity_date.is_active;

delete from public.activity_dates
where not is_active;

do $$
declare
  definition text;
  function_record record;
begin
  -- write_activity_v5 deletes removed date IDs and their related data before
  -- delegating the remaining field and date writes to write_activity_v3.
  select pg_get_functiondef(procedure.oid)
    into definition
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.prokind = 'f'
    and procedure.proname = 'write_activity_v3'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_activity_id bigint, p_payload jsonb';

  if definition is null then
    raise exception 'write_activity_v3(bigint, jsonb) is required before removing activity_dates.is_active';
  end if;

  definition := regexp_replace(
    definition,
    E'\s*update\s+public\.activity_dates\s+set\s+is_active\s*=\s*false\s+where\s+season_id\s*=\s+activity_row\.id\s+and\s+is_active\s*;',
    E'\n',
    'gi'
  );
  definition := replace(definition, ', is_active)', ')');
  definition := regexp_replace(definition, E',\s*true\s*\n\s*from\s+input_dates', E'\n  from input_dates', 'gi');
  definition := replace(definition, E'on conflict (season_id, activity_date) do update\n  set is_active = true;', 'on conflict (season_id, activity_date) do nothing;');
  definition := replace(definition, E'on conflict (season_id, activity_date) do update\nset is_active = true;', 'on conflict (season_id, activity_date) do nothing;');

  if definition ~ E'\mis_active\M' then
    raise exception 'Unable to remove is_active from write_activity_v3';
  end if;

  execute definition;

  -- Recreate all installed functions that filter activity dates by is_active.
  -- This keeps their established signatures, grants, and current definitions.
  for function_record in
    select procedure.oid, procedure.proname, pg_get_functiondef(procedure.oid) as definition
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prokind = 'f'
      and procedure.proname <> 'write_activity_v3'
      and pg_get_functiondef(procedure.oid) ~ E'\mis_active\M'
  loop
    definition := regexp_replace(
      function_record.definition,
      E'where\s+[a-z_][a-z_0-9]*\.is_active\s+and\s+',
      'where ',
      'gi'
    );
    definition := regexp_replace(
      definition,
      E'\s+and\s+[a-z_][a-z_0-9]*\.is_active\s+and\s+',
      ' and ',
      'gi'
    );
    definition := regexp_replace(
      definition,
      E'\s+and\s+[a-z_][a-z_0-9]*\.is_active\M',
      '',
      'gi'
    );
    definition := regexp_replace(
      definition,
      E'where\s+[a-z_][a-z_0-9]*\.is_active\M',
      'where true',
      'gi'
    );

    if definition ~ E'\mis_active\M' then
      raise exception 'Unable to remove is_active from function %', function_record.proname;
    end if;

    execute definition;
  end loop;
end;
$$;

drop index if exists public.activity_dates_active_date_idx;

alter table public.activity_dates
  drop column is_active;
