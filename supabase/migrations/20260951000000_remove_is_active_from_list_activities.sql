-- Remove the remaining activity-date status predicates from installed RPCs,
-- including list_activities used by the public activity list.

do $$
declare
  function_record record;
  definition text;
begin
  for function_record in
    select procedure.oid, procedure.proname, pg_get_functiondef(procedure.oid) as definition
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prokind = 'f'
      and position('is_active' in pg_get_functiondef(procedure.oid)) > 0
  loop
    definition := replace(function_record.definition, 'date_row.is_active and ', '');
    definition := replace(definition, 'activity_date.is_active and ', '');
    definition := replace(definition, 'and date_row.is_active', '');
    definition := replace(definition, 'and activity_date.is_active', '');
    definition := replace(definition, 'where date_row.is_active', 'where true');
    definition := replace(definition, 'where activity_date.is_active', 'where true');

    if position('is_active' in definition) > 0 then
      raise exception 'Unable to remove is_active from function %', function_record.proname;
    end if;

    execute definition;
  end loop;
end;
$$;
