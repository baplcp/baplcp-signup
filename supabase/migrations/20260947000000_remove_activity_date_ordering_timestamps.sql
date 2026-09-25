-- Activity dates are canonical `date` values and are always submitted in
-- chronological order. Keep their display order derived from activity_date.
-- Retired dates remain governed by is_active.

do $$
declare
  function_record record;
  definition text;
begin
  -- The season rename migration rewrites SQL function bodies dynamically, so
  -- transform the installed definitions instead of editing historical files.
  for function_record in
    select procedure.oid, procedure.proname, pg_get_functiondef(procedure.oid) as definition
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and pg_get_functiondef(procedure.oid) ~ E'\\msort_order\\M'
      and procedure.proname in (
        'get_activity_page',
        'list_registration_open_notification_candidates'
      )
  loop
    definition := regexp_replace(
      function_record.definition,
      E',\\s*date_row\\.sort_order',
      '',
      'g'
    );
    definition := regexp_replace(definition, E'\\msort_order\\M', 'activity_date', 'g');
    execute definition;
  end loop;

  select pg_get_functiondef(procedure.oid)
  into definition
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'write_activity_v3'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_activity_id bigint, p_payload jsonb';

  if definition is null then
    raise exception 'write_activity_v3(bigint, jsonb) is required before removing activity_dates columns';
  end if;

  -- The input list has already been canonicalized and sorted by activity-admin.
  -- Retaining WITH ORDINALITY and GROUP BY is harmless; only the ordinal value
  -- itself is no longer persisted.
  definition := regexp_replace(definition, E',\\s*min\\(item\\.ordinality\\)::integer as sort_order', '', 'g');
  definition := replace(definition, ', sort_order, is_active)', ', is_active)');
  definition := regexp_replace(definition, E',\\s*input_dates\\.sort_order', '', 'g');
  definition := regexp_replace(definition, E'\\s*set sort_order = excluded\\.sort_order,\\s*', E'\n  set ', 'g');
  definition := regexp_replace(definition, E',\\s*updated_at = now\\(\\)', '', 'g');
  -- The preceding rename keeps the RPC parameter name but rewrites body uses.
  definition := regexp_replace(definition, E'\\mp_season_id\\M', 'p_activity_id', 'g');
  execute definition;
end;
$$;

alter table public.activity_dates
  drop constraint if exists activity_dates_sort_order_check,
  drop column sort_order,
  drop column updated_at;
