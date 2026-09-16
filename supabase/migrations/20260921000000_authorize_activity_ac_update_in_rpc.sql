-- Keep organizer authorization and the activity AC update in one database request.
-- The Edge Function verifies the LINE access token before passing its user ID.

create or replace function public.set_activity_ac_enabled_v1(
  p_activity_id bigint,
  p_organizer_user_id text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.members as member
    where member.user_id = p_organizer_user_id
      and member.role = 'organizer'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.activities
  set ac_enabled = p_enabled
  where id = p_activity_id;
end;
$$;

revoke all on function public.set_activity_ac_enabled_v1(bigint, text, boolean) from public;
grant execute on function public.set_activity_ac_enabled_v1(bigint, text, boolean) to service_role;
