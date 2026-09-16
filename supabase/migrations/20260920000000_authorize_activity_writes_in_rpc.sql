-- Keep organizer authorization and activity writes in one database request.
-- The Edge Function verifies the LINE access token before passing its user ID.

create or replace function public.write_activity_v4(
  p_activity_id bigint,
  p_organizer_user_id text,
  p_payload jsonb
)
returns public.activities
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

  return public.write_activity_v3(p_activity_id, p_payload);
end;
$$;

create or replace function public.delete_activity_v1(
  p_activity_id bigint,
  p_organizer_user_id text
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

  delete from public.activities
  where id = p_activity_id;
end;
$$;

revoke all on function public.write_activity_v4(bigint, text, jsonb) from public;
revoke all on function public.delete_activity_v1(bigint, text) from public;

grant execute on function public.write_activity_v4(bigint, text, jsonb) to service_role;
grant execute on function public.delete_activity_v1(bigint, text) to service_role;
