-- `activities` represents a season. Rename the relation and every direct
-- foreign-key column so the database contract uses the domain terminology.
begin;

create temporary table season_rename_function_definitions on commit drop as
select
  procedure.oid,
  procedure.proname,
  pg_get_functiondef(procedure.oid) as definition,
  procedure.proname in (
    'list_activities',
    'list_registration_open_notification_candidates',
    'list_activity_reminder_notification_candidates'
  ) as rename_output_fields
from pg_proc as procedure
join pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.prokind = 'f'
  and (
    pg_get_functiondef(procedure.oid) ~ E'\\mactivities\\M'
    or pg_get_functiondef(procedure.oid) ~ E'\\mactivity_id\\M'
  );

alter table public.activities rename to seasons;

alter table public.activity_dates rename column activity_id to season_id;
alter table public.registrations rename column activity_id to season_id;
alter table public.registration_guests rename column activity_id to season_id;

-- PostgreSQL treats RETURNS TABLE field names as part of a function's return
-- type. These RPCs must be dropped before their season identifier output can
-- become season_id; they have no database dependants.
drop function public.list_activities(text, integer, timestamptz, date, timestamptz, bigint);
drop function public.list_registration_open_notification_candidates(timestamptz, timestamptz);
drop function public.list_activity_reminder_notification_candidates(date, integer);

-- View definitions are dependency-tracked and follow ALTER TABLE RENAME, but
-- SQL and PL/pgSQL function bodies retain their original text. Recreate every
-- affected function with the new relation and foreign-key identifiers while
-- preserving its header: PostgreSQL does not allow CREATE OR REPLACE FUNCTION
-- to rename RETURNS TABLE output fields.
do $$
declare
  function_record record;
  body_start integer;
begin
  for function_record in
    select proname, definition, rename_output_fields
    from season_rename_function_definitions
  loop
    body_start := strpos(function_record.definition, E'\nAS ');
    if body_start = 0 then
      raise exception 'Unable to locate function body while renaming activities to seasons';
    end if;

    if function_record.proname = 'list_activity_reminder_notification_candidates' then
      execute regexp_replace(
        regexp_replace(
          regexp_replace(function_record.definition, E'(RETURNS TABLE\\([^)]*)\\mid\\M', E'\\1season_id'),
          E'\\mactivities\\M',
          'seasons',
          'g'
        ),
        E'\\mactivity_id\\M',
        'season_id',
        'g'
      );
    elsif function_record.rename_output_fields then
      execute regexp_replace(
        regexp_replace(function_record.definition, E'\\mactivities\\M', 'seasons', 'g'),
        E'\\mactivity_id\\M',
        'season_id',
        'g'
      );
    else
      execute regexp_replace(left(function_record.definition, body_start), E'\\mactivities\\M', 'seasons', 'g') || regexp_replace(
        regexp_replace(substr(function_record.definition, body_start + 1), E'\\mactivities\\M', 'seasons', 'g'),
        E'\\mactivity_id\\M',
        'season_id',
        'g'
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.list_activities(text, integer, timestamptz, date, timestamptz, bigint) from public;
grant execute on function public.list_activities(text, integer, timestamptz, date, timestamptz, bigint) to anon, authenticated, service_role;
revoke all on function public.list_registration_open_notification_candidates(timestamptz, timestamptz) from public;
grant execute on function public.list_registration_open_notification_candidates(timestamptz, timestamptz) to service_role;
revoke all on function public.list_activity_reminder_notification_candidates(date, integer) from public;
grant execute on function public.list_activity_reminder_notification_candidates(date, integer) to service_role;

commit;
