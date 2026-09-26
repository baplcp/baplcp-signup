-- 群內成員每場最多只能帶 1 位群外朋友（原本 2 位）；主揪不受限。
-- 調降前已經帶 2 位的報名可以保留、修改或減少，但不能再增加。

create or replace function public.write_registration_guests_v1(
  p_activity_id bigint,
  p_activity_date_id bigint,
  p_invited_by uuid,
  p_guests jsonb,
  p_invitation_limit integer default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  active_guest_total integer;
  previous_guest_total integer;
begin
  if jsonb_typeof(p_guests) <> 'array' then
    raise exception 'invalid_guests' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.activity_dates
    where id = p_activity_date_id and season_id = p_activity_id
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  perform 1 from public.seasons where id = p_activity_id for update;

  select count(*)::integer into previous_guest_total
  from public.registration_guests
  where season_id = p_activity_id
    and activity_date_id = p_activity_date_id
    and invited_by = p_invited_by
    and cancelled_at is null;

  if exists (
    select 1
    from jsonb_array_elements(p_guests) as item(value)
    where nullif(item.value ->> 'id', '') is not null
      and not exists (
        select 1
        from public.registration_guests as guest
        where guest.id = nullif(item.value ->> 'id', '')::uuid
          and guest.season_id = p_activity_id
          and guest.activity_date_id = p_activity_date_id
          and guest.invited_by = p_invited_by
          and guest.cancelled_at is null
      )
  ) then
    raise exception 'guest_not_found' using errcode = 'P0002';
  end if;

  update public.registration_guests as guest
  set cancelled_at = now(), updated_at = now()
  where guest.season_id = p_activity_id
    and guest.activity_date_id = p_activity_date_id
    and guest.invited_by = p_invited_by
    and guest.cancelled_at is null
    and not exists (
      select 1
      from jsonb_array_elements(p_guests) as item(value)
      where nullif(item.value ->> 'id', '')::uuid = guest.id
    );

  update public.registration_guests as guest
  set display_name = nullif(btrim(item.value ->> 'name'), ''),
      gender = case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end,
      paid_court = case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end,
      paid_ac = case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end,
      updated_at = now()
  from jsonb_array_elements(p_guests) as item(value)
  where guest.id = nullif(item.value ->> 'id', '')::uuid
    and guest.cancelled_at is null;

  insert into public.registration_guests (season_id, activity_date_id, invited_by, display_name, gender, paid_court, paid_ac)
  select p_activity_id, p_activity_date_id, p_invited_by,
    nullif(btrim(item.value ->> 'name'), ''),
    case when item.value ->> 'gender' in ('male', 'female', 'other') then item.value ->> 'gender' else null end,
    case lower(coalesce(item.value ->> 'paid_court', '')) when 'true' then true when '1' then true else false end,
    case lower(coalesce(item.value ->> 'paid_ac', '')) when 'true' then true when '1' then true else false end
  from jsonb_array_elements(p_guests) as item(value)
  where nullif(item.value ->> 'id', '') is null;

  if p_invitation_limit is not null then
    select count(*)::integer into active_guest_total
    from public.registration_guests
    where season_id = p_activity_id
      and activity_date_id = p_activity_date_id
      and invited_by = p_invited_by
      and cancelled_at is null;
    -- 上限調降前已經帶超過上限的人可以保留或減少，但不能再往上加。
    if active_guest_total > p_invitation_limit and active_guest_total > previous_guest_total then
      raise exception 'guest_invitation_limit_exceeded' using errcode = 'P0001';
    end if;
  end if;
end;
$$;

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
  target_activity public.seasons%rowtype;
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

  select *
  into target_activity
  from public.seasons as activity
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
    where date_row.season_id = p_activity_id
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
  where registration.season_id = p_activity_id
    and registration.member_id = target_member_id
    and registration.cancelled_at is null
    and registration.activity_date_id is not distinct from target_activity_date_id;

  if p_self_count = 1 then
    begin
      perform public.write_registration_v3(
        active_registration_id,
        jsonb_build_object('season_id', p_activity_id, 'activity_date_id', target_activity_date_id, 'member_id', target_member_id)
      );
    exception when unique_violation then
      -- A concurrent request can create this member's active row after the
      -- lookup. Reuse it, matching the previous Edge Function retry policy.
      select registration.id
      into active_registration_id
      from public.registrations as registration
      where registration.season_id = p_activity_id
        and registration.member_id = target_member_id
        and registration.cancelled_at is null
        and registration.activity_date_id is not distinct from target_activity_date_id;
      if active_registration_id is null then
        raise;
      end if;
      perform public.write_registration_v3(
        active_registration_id,
        jsonb_build_object('season_id', p_activity_id, 'activity_date_id', target_activity_date_id, 'member_id', target_member_id)
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
      case when is_admin then null else 1 end
    );
  end if;
end;
$$;

revoke all on function public.write_registration_guests_v1(bigint, bigint, uuid, jsonb, integer) from public;
grant execute on function public.write_registration_guests_v1(bigint, bigint, uuid, jsonb, integer) to service_role;
revoke all on function public.save_registration_action_v1(text, text, text, bigint, date, integer, integer, jsonb, timestamptz) from public;
grant execute on function public.save_registration_action_v1(text, text, text, bigint, date, integer, integer, jsonb, timestamptz) to service_role;
