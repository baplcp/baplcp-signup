-- A regular signup previously crossed the PostgREST boundary for each
-- member, role, lookup, self-write, and guest-write operation.  Keep those
-- operations in one transaction so the activity lock is retained throughout
-- the request and never released between self and guest mutations.

create or replace function public.save_registration_action_v1(
  p_user_id text,
  p_display_name text,
  p_picture_url text,
  p_activity_id bigint,
  p_activity_date date,
  p_self_count integer,
  p_guest_count integer,
  p_guests jsonb,
  p_submit_time timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target_member_id uuid;
  target_member_role text;
  target_activity public.activities%rowtype;
  target_activity_date_id bigint;
  active_registration_id uuid;
  is_admin boolean;
  registration_open_at timestamptz;
  registration_close_at timestamptz;
begin
  if p_user_id is null or btrim(p_user_id) = '' then
    raise exception 'invalid_line_profile' using errcode = '22023';
  end if;
  if p_self_count is null or p_self_count not in (0, 1) then
    raise exception 'invalid_self_count' using errcode = '22023';
  end if;
  if p_guest_count is null or p_guest_count < 0 or coalesce(jsonb_typeof(p_guests), '') <> 'array' then
    raise exception 'invalid_guest_count' using errcode = '22023';
  end if;
  if jsonb_array_length(p_guests) <> p_guest_count then
    raise exception 'guest_count_mismatch' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_guests) as guest(value)
    where jsonb_typeof(guest.value) <> 'object'
      or guest.value ->> 'gender' not in ('male', 'female')
      or char_length(coalesce(guest.value ->> 'name', '')) > 40
      or (guest.value ? 'id' and coalesce(guest.value ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) then
    raise exception 'invalid_guests' using errcode = '22023';
  end if;

  -- members.user_id is unique.  The upsert replaces the old select followed
  -- by update/insert while preserving the existing role.
  insert into public.members as member (user_id, display_name, picture_url, role)
  values (p_user_id, p_display_name, p_picture_url, 'member')
  on conflict (user_id) do update
  set display_name = excluded.display_name,
      picture_url = excluded.picture_url
  returning id, role into target_member_id, target_member_role;

  is_admin := target_member_role = 'organizer';
  if not is_admin and p_guest_count > 2 then
    raise exception 'invalid_guest_count' using errcode = '22023';
  end if;

  select *
  into target_activity
  from public.activities as activity
  where activity.id = p_activity_id;
  if not found then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  if p_activity_date is null then
    if not target_activity.season_enabled then
      raise exception 'season_disabled' using errcode = 'P0001';
    end if;
  else
    select date_row.id
    into target_activity_date_id
    from public.activity_dates as date_row
    where date_row.activity_id = p_activity_id
      and date_row.activity_date = p_activity_date;
    if target_activity_date_id is null then
      raise exception 'activity_date_not_found' using errcode = 'P0002';
    end if;
  end if;

  if p_self_count + p_guest_count > 0 then
    if p_activity_date is null then
      if target_activity.season_open_date is not null and target_activity.season_open_time is not null then
        registration_open_at := (target_activity.season_open_date + target_activity.season_open_time) at time zone 'Asia/Taipei';
        if now() < registration_open_at then
          raise exception 'registration_not_open' using errcode = 'P0001';
        end if;
      end if;
      if not is_admin and target_activity.season_close_date is not null and target_activity.season_close_time is not null then
        registration_close_at := (target_activity.season_close_date + target_activity.season_close_time) at time zone 'Asia/Taipei';
        if now() >= registration_close_at then
          raise exception 'registration_closed' using errcode = 'P0001';
        end if;
      end if;
    else
      if target_activity.pickup_open_days_before is not null and target_activity.pickup_open_time is not null then
        registration_open_at := ((p_activity_date - target_activity.pickup_open_days_before) + target_activity.pickup_open_time) at time zone 'Asia/Taipei';
        if now() < registration_open_at then
          raise exception 'registration_not_open' using errcode = 'P0001';
        end if;
      end if;
      if not is_admin and target_activity.pickup_deadline_type = 'custom' and target_activity.pickup_close_days_before is not null and target_activity.pickup_close_time is not null then
        registration_close_at := ((p_activity_date - target_activity.pickup_close_days_before) + target_activity.pickup_close_time) at time zone 'Asia/Taipei';
        if now() >= registration_close_at then
          raise exception 'registration_closed' using errcode = 'P0001';
        end if;
      end if;
    end if;
  end if;

  select registration.id
  into active_registration_id
  from public.registrations as registration
  where registration.activity_id = p_activity_id
    and registration.member_id = target_member_id
    and registration.cancelled_at is null
    and registration.activity_date_id is not distinct from target_activity_date_id;

  if p_self_count = 1 then
    begin
      perform public.write_registration_v3(
        active_registration_id,
        jsonb_build_object('activity_id', p_activity_id, 'activity_date_id', target_activity_date_id, 'member_id', target_member_id)
      );
    exception when unique_violation then
      -- A concurrent request can create this member's active row after the
      -- lookup. Reuse it, matching the previous Edge Function retry policy.
      select registration.id
      into active_registration_id
      from public.registrations as registration
      where registration.activity_id = p_activity_id
        and registration.member_id = target_member_id
        and registration.cancelled_at is null
        and registration.activity_date_id is not distinct from target_activity_date_id;
      if active_registration_id is null then
        raise;
      end if;
      perform public.write_registration_v3(
        active_registration_id,
        jsonb_build_object('activity_id', p_activity_id, 'activity_date_id', target_activity_date_id, 'member_id', target_member_id)
      );
    end;
  elsif active_registration_id is not null then
    perform public.write_registration_v3(
      active_registration_id,
      jsonb_build_object('cancelled_at', coalesce(p_submit_time, now()))
    );
  end if;

  if target_activity_date_id is not null then
    perform public.write_registration_guests_v1(
      p_activity_id,
      target_activity_date_id,
      target_member_id,
      p_guests,
      case when is_admin then null else 2 end
    );
  end if;
end;
$$;

revoke all on function public.save_registration_action_v1(text, text, text, bigint, date, integer, integer, jsonb, timestamptz) from public;
grant execute on function public.save_registration_action_v1(text, text, text, bigint, date, integer, integer, jsonb, timestamptz) to service_role;

comment on function public.save_registration_action_v1(text, text, text, bigint, date, integer, integer, jsonb, timestamptz) is
  'Atomically synchronizes a LINE member and saves a self/guest registration in one service-role RPC.';
