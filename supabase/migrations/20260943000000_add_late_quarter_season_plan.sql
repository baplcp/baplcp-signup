-- 季打新增「後季」方案：活動日期跨過一季分界點後的場次可以單獨報名。
-- 同時修正名單與名額的長期問題：先前每個地方都直接把所有季打報名算進每一
-- 場，只報一季的人在後三個月仍佔名額，方案涵蓋範圍必須成為共同規則。

alter table public.activities
  add column if not exists season_late_enabled boolean not null default false,
  add column if not exists season_late_total_fee numeric,
  add column if not exists season_late_open_date date,
  add column if not exists season_late_open_time time without time zone,
  add column if not exists season_late_deadline_type text,
  add column if not exists season_late_close_date date,
  add column if not exists season_late_close_time time without time zone;

comment on column public.activities.season_late_enabled is
  '是否開放後季報名。關閉時後季方案不會出現在報名頁，Edge Function 也會拒絕。';
comment on column public.activities.season_late_total_fee is
  '後季總費用，沿用 season_fee_per_session 單價乘以後季場次。';

-- 先把歷史資料收斂成已知方案，約束才不會因為舊值而套用失敗。
update public.registrations
set season_plan = 'quarter'
where season_plan is not null
  and season_plan not in ('quarter', 'late-quarter', 'half-year');

alter table public.registrations
  drop constraint if exists registrations_season_plan_check;
alter table public.registrations
  add constraint registrations_season_plan_check
  check (season_plan is null or season_plan in ('quarter', 'late-quarter', 'half-year'));

-- 分界點只取決於第一場日期：第一場所在月份起算三個月。
create or replace function public.activity_season_quarter_cutoff(p_activity_id bigint)
returns date
language sql
stable
as $$
  select (date_trunc('month', min(activity_date.activity_date)) + interval '3 months')::date
  from public.activity_dates as activity_date
  where activity_date.activity_id = p_activity_id
    and activity_date.is_active;
$$;

-- 與前端 src/utils/seasonPlan.js、Edge Function _shared/season-plan.ts 同一套規則。
create or replace function public.season_plan_covers_date(
  p_season_plan text,
  p_activity_date date,
  p_quarter_cutoff date
)
returns boolean
language sql
immutable
as $$
  select case
    when coalesce(p_season_plan, 'quarter') = 'half-year' then true
    when p_activity_date is null or p_quarter_cutoff is null then false
    when p_season_plan = 'late-quarter' then p_activity_date >= p_quarter_cutoff
    else p_activity_date < p_quarter_cutoff
  end;
$$;

-- 季打名額只在涵蓋範圍重疊的方案之間互相佔用：一季與後季不重疊，半年與兩者都重疊。
create or replace function public.season_plans_overlap(p_left text, p_right text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_left, 'quarter') = coalesce(p_right, 'quarter')
    or coalesce(p_left, 'quarter') = 'half-year'
    or coalesce(p_right, 'quarter') = 'half-year';
$$;

-- 報名寫入：季打名額改看方案是否重疊，臨打名額只算方案涵蓋當天的季打成員。
create or replace function public.write_registration_v3(
  p_registration_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target_registration_id uuid;
  target_activity_id bigint;
  target_activity_date_id bigint;
  target_activity_date date;
  target_member_id uuid;
  target_season_plan text;
  quarter_cutoff date;
  capacity integer;
  occupied_total integer;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;

  if p_registration_id is null then
    target_activity_id := (p_payload ->> 'activity_id')::bigint;
    target_activity_date_id := nullif(p_payload ->> 'activity_date_id', '')::bigint;
    target_member_id := nullif(p_payload ->> 'member_id', '')::uuid;
  else
    select activity_id, activity_date_id, member_id
      into target_activity_id, target_activity_date_id, target_member_id
      from public.registrations where id = p_registration_id;
    if target_activity_id is null then
      raise exception 'registration_not_found' using errcode = 'P0002';
    end if;
  end if;

  if target_activity_id is null or target_member_id is null then
    raise exception 'invalid_registration_payload' using errcode = '22023';
  end if;
  if target_activity_date_id is not null and not exists (
    select 1 from public.activity_dates
    where id = target_activity_date_id and activity_id = target_activity_id
  ) then
    raise exception 'activity_date_not_found' using errcode = 'P0002';
  end if;

  perform 1 from public.activities where id = target_activity_id for update;

  if p_registration_id is null then
    insert into public.registrations (activity_id, activity_date_id, member_id, paid_court, paid_ac, season_plan, cancelled_at)
    values (
      target_activity_id, target_activity_date_id, target_member_id,
      coalesce((p_payload ->> 'paid_court')::boolean, false),
      coalesce((p_payload ->> 'paid_ac')::boolean, false),
      coalesce(p_payload ->> 'season_plan', 'quarter'),
      public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at')
    ) returning id, season_plan into target_registration_id, target_season_plan;
  else
    update public.registrations as registration
    set cancelled_at = case when p_payload ? 'cancelled_at' then public.normalization_safe_timestamptz(p_payload ->> 'cancelled_at') else registration.cancelled_at end,
        paid_court = case when p_payload ? 'paid_court' then (p_payload ->> 'paid_court')::boolean else registration.paid_court end,
        paid_ac = case when p_payload ? 'paid_ac' then (p_payload ->> 'paid_ac')::boolean else registration.paid_ac end,
        season_plan = case when p_payload ? 'season_plan' then p_payload ->> 'season_plan' else registration.season_plan end
    where registration.id = p_registration_id
    returning registration.id, registration.season_plan into target_registration_id, target_season_plan;
  end if;

  quarter_cutoff := public.activity_season_quarter_cutoff(target_activity_id);

  if target_activity_date_id is null then
    -- 20260938 的版本寫成 '^\\d+$'，在 dollar quote 內會變成比對反斜線，
    -- 數字的季打名額因此一律被當成不限，這裡恢復成正確的數字比對。
    select case
      when nullif(btrim(season_capacity::text), '') is null then null
      when lower(season_capacity::text) = 'unlimited' then null
      when season_capacity::text ~ '^\d+$' then season_capacity::integer
      else null
    end into capacity from public.activities where id = target_activity_id;
    if capacity is not null and capacity > 0 then
      select count(*)::integer into occupied_total from public.registrations
      where activity_id = target_activity_id and activity_date_id is null and cancelled_at is null
        and public.season_plans_overlap(season_plan, target_season_plan);
      if occupied_total > capacity then raise exception 'season_capacity_exceeded' using errcode = 'P0001'; end if;
    end if;
  else
    select activity_date into target_activity_date from public.activity_dates where id = target_activity_date_id;
    select single_capacity into capacity from public.activities where id = target_activity_id;
    if capacity is not null and capacity > 0 then
      select
        (select count(*) from public.registrations where activity_date_id = target_activity_date_id and cancelled_at is null)
        + (select count(*) from public.registration_guests where activity_date_id = target_activity_date_id and cancelled_at is null)
        + (select count(*) from public.registrations as registration
           left join public.season_registration_date_statuses as date_status
             on date_status.registration_id = registration.id and date_status.activity_date_id = target_activity_date_id
           where registration.activity_id = target_activity_id and registration.activity_date_id is null
             and registration.cancelled_at is null and not coalesce(date_status.is_on_leave, false)
             and public.season_plan_covers_date(registration.season_plan, target_activity_date, quarter_cutoff))
      into occupied_total;
      if occupied_total > capacity then raise exception 'single_capacity_exceeded' using errcode = 'P0001'; end if;
    end if;
  end if;
  return target_registration_id;
end;
$$;

-- 活動列表的場次人數同樣只計入方案涵蓋該場次的季打成員。
drop function if exists public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint);
create function public.list_group_activity_sessions(p_segment text, p_limit integer, p_now timestamptz, p_cursor_activity_date date default null, p_cursor_created_at timestamptz default null, p_cursor_activity_date_id bigint default null)
returns table (activity_id bigint, activity_date date, title text, location text, start_time text, end_time text, single_capacity integer, occupied_count integer, activity_created_at timestamptz, activity_date_id bigint)
language sql stable security invoker as $$
  with local_time as (select (p_now at time zone 'Asia/Taipei')::date as today), requested_dates as (
    select date_row.id, date_row.activity_id, date_row.activity_date, activity.title, activity.location, activity.start_time, activity.end_time, activity.single_capacity, activity.created_at
    from public.activity_dates as date_row join public.activities as activity on activity.id = date_row.activity_id cross join local_time
    where date_row.is_active
      and (
        (p_segment = 'upcoming' and (date_row.activity_date > local_time.today or (date_row.activity_date = local_time.today and (activity.end_time is null or ((date_row.activity_date + activity.end_time + interval '1 hour') at time zone 'Asia/Taipei') >= p_now))))
        or (p_segment = 'ended' and (date_row.activity_date < local_time.today or (date_row.activity_date = local_time.today and activity.end_time is not null and ((date_row.activity_date + activity.end_time + interval '1 hour') at time zone 'Asia/Taipei') < p_now)))
      )
      and (
        p_cursor_activity_date is null
        or (p_segment = 'upcoming' and (date_row.activity_date > p_cursor_activity_date or (date_row.activity_date = p_cursor_activity_date and (activity.created_at < p_cursor_created_at or (activity.created_at = p_cursor_created_at and date_row.id > p_cursor_activity_date_id)))))
        or (p_segment = 'ended' and (date_row.activity_date < p_cursor_activity_date or (date_row.activity_date = p_cursor_activity_date and (activity.created_at < p_cursor_created_at or (activity.created_at = p_cursor_created_at and date_row.id > p_cursor_activity_date_id)))))
      )
    order by case when p_segment = 'upcoming' then date_row.activity_date end asc, case when p_segment = 'ended' then date_row.activity_date end desc, activity.created_at desc, date_row.id limit least(greatest(coalesce(p_limit, 0), 0), 50)
  ), activity_cutoffs as (
    select distinct requested_dates.activity_id, public.activity_season_quarter_cutoff(requested_dates.activity_id) as quarter_cutoff from requested_dates
  ), pickup_people as (select registration.activity_date_id, count(*)::integer as self_count from public.registrations as registration join requested_dates on requested_dates.id = registration.activity_date_id where registration.cancelled_at is null group by registration.activity_date_id),
  guest_people as (select guest.activity_date_id, count(*)::integer as guest_count from public.registration_guests as guest join requested_dates on requested_dates.id = guest.activity_date_id where guest.cancelled_at is null group by guest.activity_date_id),
  season_people as (
    select requested_dates.id as activity_date_id, count(registration.id) filter (where not coalesce(date_status.is_on_leave, false))::integer as self_count
    from requested_dates
    join activity_cutoffs on activity_cutoffs.activity_id = requested_dates.activity_id
    left join public.registrations as registration
      on registration.activity_id = requested_dates.activity_id and registration.activity_date_id is null and registration.cancelled_at is null
      and public.season_plan_covers_date(registration.season_plan, requested_dates.activity_date, activity_cutoffs.quarter_cutoff)
    left join public.season_registration_date_statuses as date_status on date_status.registration_id = registration.id and date_status.activity_date_id = requested_dates.id
    group by requested_dates.id
  )
  select requested_dates.activity_id, requested_dates.activity_date, requested_dates.title, requested_dates.location, requested_dates.start_time::text, requested_dates.end_time::text, requested_dates.single_capacity, coalesce(pickup_people.self_count, 0) + coalesce(guest_people.guest_count, 0) + coalesce(season_people.self_count, 0), requested_dates.created_at, requested_dates.id
  from requested_dates left join pickup_people on pickup_people.activity_date_id = requested_dates.id left join guest_people on guest_people.activity_date_id = requested_dates.id left join season_people on season_people.activity_date_id = requested_dates.id
  order by case when p_segment = 'upcoming' then requested_dates.activity_date end asc, case when p_segment = 'ended' then requested_dates.activity_date end desc, requested_dates.created_at desc, requested_dates.id;
$$;

-- 個人參與次數改用共用的涵蓋判斷，後季才會被算進去。
create or replace function public.count_past_participations(p_user_id text, p_start_date date, p_end_date date)
returns bigint language sql stable security invoker as $$
  with taiwan_now as (select timezone('Asia/Taipei', now()) as value), target_member as (select id from public.members where user_id = p_user_id),
  pickup_count as (select count(*) as value from public.registrations as registration join target_member as member on member.id = registration.member_id join public.activity_dates as activity_date on activity_date.id = registration.activity_date_id join public.activities as activity on activity.id = registration.activity_id cross join taiwan_now
    where registration.cancelled_at is null and activity_date.activity_date >= p_start_date and (activity_date.activity_date < p_end_date or (activity_date.activity_date = p_end_date and activity.end_time is not null and taiwan_now.value::time > activity.end_time))),
  season_count as (select count(*) as value from public.registrations as registration join target_member as member on member.id = registration.member_id join public.activities as activity on activity.id = registration.activity_id join public.activity_dates as activity_date on activity_date.activity_id = registration.activity_id left join public.season_registration_date_statuses as date_status on date_status.registration_id = registration.id and date_status.activity_date_id = activity_date.id cross join taiwan_now
    where registration.cancelled_at is null and registration.activity_date_id is null and activity_date.activity_date >= p_start_date and (activity_date.activity_date < p_end_date or (activity_date.activity_date = p_end_date and activity.end_time is not null and taiwan_now.value::time > activity.end_time)) and public.season_plan_covers_date(registration.season_plan, activity_date.activity_date, public.activity_season_quarter_cutoff(registration.activity_id)) and not coalesce(date_status.is_on_leave, false))
  select pickup_count.value + season_count.value from pickup_count cross join season_count;
$$;


-- 建立與編輯活動時一併寫入後季的開放時間與總費用。
create or replace function public.write_activity_v3(
  p_activity_id bigint,
  p_payload jsonb
)
returns public.activities
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  activity_row public.activities;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_activity_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload -> 'dates') <> 'array' then
    raise exception 'invalid_activity_dates' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_payload -> 'dates') as date_value(value)
    where public.normalization_safe_date(date_value.value) is null
  ) then
    raise exception 'invalid_activity_dates' using errcode = '22023';
  end if;

  perform set_config('app.normalization_write', 'on', true);

  if p_activity_id is null then
    insert into public.activities (
      game_type, title, location, start_time, end_time,
      season_fee_per_session, season_half_year_fee_per_session,
      pickup_fee_per_session, ac_fee, single_capacity, season_enabled,
      season_include_ac, season_total_fee, season_half_year_total_fee,
      season_capacity, season_open_date, season_open_time,
      season_deadline_type, season_close_date, season_close_time,
      season_late_enabled, season_late_total_fee,
      season_late_open_date, season_late_open_time,
      season_late_deadline_type, season_late_close_date, season_late_close_time,
      pickup_label, pickup_open_days_before, pickup_open_time,
      pickup_deadline_type, pickup_close_days_before, pickup_close_time,
      reminder_enabled, reminder_days_before, reminder_time
    ) values (
      p_payload ->> 'game_type', p_payload ->> 'title', p_payload ->> 'location',
      nullif(p_payload ->> 'start_time', '')::time,
      nullif(p_payload ->> 'end_time', '')::time,
      (p_payload ->> 'season_fee_per_session')::integer, (p_payload ->> 'season_half_year_fee_per_session')::numeric,
      (p_payload ->> 'pickup_fee_per_session')::integer, (p_payload ->> 'ac_fee')::integer, (p_payload ->> 'single_capacity')::integer,
      (p_payload ->> 'season_enabled')::boolean, (p_payload ->> 'season_include_ac')::boolean,
      (p_payload ->> 'season_total_fee')::integer, (p_payload ->> 'season_half_year_total_fee')::numeric,
      p_payload ->> 'season_capacity',
      nullif(p_payload ->> 'season_open_date', '')::date,
      nullif(p_payload ->> 'season_open_time', '')::time,
      p_payload ->> 'season_deadline_type',
      nullif(p_payload ->> 'season_close_date', '')::date,
      nullif(p_payload ->> 'season_close_time', '')::time,
      coalesce((p_payload ->> 'season_late_enabled')::boolean, false),
      (p_payload ->> 'season_late_total_fee')::numeric,
      nullif(p_payload ->> 'season_late_open_date', '')::date,
      nullif(p_payload ->> 'season_late_open_time', '')::time,
      p_payload ->> 'season_late_deadline_type',
      nullif(p_payload ->> 'season_late_close_date', '')::date,
      nullif(p_payload ->> 'season_late_close_time', '')::time,
      p_payload ->> 'pickup_label', (p_payload ->> 'pickup_open_days_before')::integer,
      nullif(p_payload ->> 'pickup_open_time', '')::time,
      p_payload ->> 'pickup_deadline_type', (p_payload ->> 'pickup_close_days_before')::integer,
      nullif(p_payload ->> 'pickup_close_time', '')::time,
      (p_payload ->> 'reminder_enabled')::boolean, (p_payload ->> 'reminder_days_before')::integer,
      nullif(p_payload ->> 'reminder_time', '')::time
    )
    returning * into activity_row;
  else
    update public.activities as activity
    set game_type = p_payload ->> 'game_type',
        title = p_payload ->> 'title',
        location = p_payload ->> 'location',
        start_time = nullif(p_payload ->> 'start_time', '')::time,
        end_time = nullif(p_payload ->> 'end_time', '')::time,
        season_fee_per_session = (p_payload ->> 'season_fee_per_session')::integer,
        season_half_year_fee_per_session = (p_payload ->> 'season_half_year_fee_per_session')::numeric,
        pickup_fee_per_session = (p_payload ->> 'pickup_fee_per_session')::integer,
        ac_fee = (p_payload ->> 'ac_fee')::integer,
        single_capacity = (p_payload ->> 'single_capacity')::integer,
        season_enabled = (p_payload ->> 'season_enabled')::boolean,
        season_include_ac = (p_payload ->> 'season_include_ac')::boolean,
        season_total_fee = (p_payload ->> 'season_total_fee')::integer,
        season_half_year_total_fee = (p_payload ->> 'season_half_year_total_fee')::numeric,
        season_capacity = p_payload ->> 'season_capacity',
        season_open_date = nullif(p_payload ->> 'season_open_date', '')::date,
        season_open_time = nullif(p_payload ->> 'season_open_time', '')::time,
        season_deadline_type = p_payload ->> 'season_deadline_type',
        season_close_date = nullif(p_payload ->> 'season_close_date', '')::date,
        season_close_time = nullif(p_payload ->> 'season_close_time', '')::time,
        season_late_enabled = coalesce((p_payload ->> 'season_late_enabled')::boolean, false),
        season_late_total_fee = (p_payload ->> 'season_late_total_fee')::numeric,
        season_late_open_date = nullif(p_payload ->> 'season_late_open_date', '')::date,
        season_late_open_time = nullif(p_payload ->> 'season_late_open_time', '')::time,
        season_late_deadline_type = p_payload ->> 'season_late_deadline_type',
        season_late_close_date = nullif(p_payload ->> 'season_late_close_date', '')::date,
        season_late_close_time = nullif(p_payload ->> 'season_late_close_time', '')::time,
        pickup_label = p_payload ->> 'pickup_label',
        pickup_open_days_before = (p_payload ->> 'pickup_open_days_before')::integer,
        pickup_open_time = nullif(p_payload ->> 'pickup_open_time', '')::time,
        pickup_deadline_type = p_payload ->> 'pickup_deadline_type',
        pickup_close_days_before = (p_payload ->> 'pickup_close_days_before')::integer,
        pickup_close_time = nullif(p_payload ->> 'pickup_close_time', '')::time,
        reminder_enabled = (p_payload ->> 'reminder_enabled')::boolean,
        reminder_days_before = (p_payload ->> 'reminder_days_before')::integer,
        reminder_time = nullif(p_payload ->> 'reminder_time', '')::time
    where activity.id = p_activity_id
    returning * into activity_row;

    if not found then
      raise exception 'activity_not_found' using errcode = 'P0002';
    end if;
  end if;

  update public.activity_dates
  set is_active = false,
      updated_at = now()
  where activity_id = activity_row.id
    and is_active;

  with input_dates as (
    select public.normalization_safe_date(item.value) as activity_date, min(item.ordinality)::integer as sort_order
    from jsonb_array_elements_text(p_payload -> 'dates') with ordinality as item(value, ordinality)
    group by public.normalization_safe_date(item.value)
  )
  insert into public.activity_dates (activity_id, activity_date, sort_order, is_active)
  select activity_row.id, input_dates.activity_date, input_dates.sort_order, true
  from input_dates
  on conflict (activity_id, activity_date) do update
  set sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now();

  return activity_row;
end;
$$;

-- 後季開放報名也要發通知，日期與 activity_date_id 取後季第一場。
create index if not exists activities_season_late_open_notification_idx
  on public.activities (season_late_open_date, season_late_open_time)
  where season_enabled and season_late_enabled and season_late_open_date is not null and season_late_open_time is not null;

create or replace function public.list_registration_open_notification_candidates(
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns table (
  activity_id bigint,
  activity_date_id bigint,
  title text,
  pickup_label text,
  location text,
  start_time text,
  end_time text,
  activity_date date,
  notification_type text
)
language sql
stable
security invoker
as $$
  select
    activity.id as activity_id,
    first_activity_date.id as activity_date_id,
    activity.title,
    activity.pickup_label,
    activity.location,
    activity.start_time::text,
    activity.end_time::text,
    first_activity_date.activity_date,
    'season'::text as notification_type
  from public.activities as activity
  left join lateral (
    select date_row.id, date_row.activity_date
    from public.activity_dates as date_row
    where date_row.activity_id = activity.id
      and date_row.is_active
    order by date_row.sort_order
    limit 1
  ) as first_activity_date on true
  where activity.season_enabled
    and activity.season_open_date is not null
    and activity.season_open_time is not null
    and activity.season_open_date >= (p_window_start at time zone 'Asia/Taipei')::date
    and activity.season_open_date <= (p_window_end at time zone 'Asia/Taipei')::date
    and ((activity.season_open_date + activity.season_open_time) at time zone 'Asia/Taipei') >= p_window_start
    and ((activity.season_open_date + activity.season_open_time) at time zone 'Asia/Taipei') < p_window_end

  union all

  select
    activity.id as activity_id,
    first_late_date.id as activity_date_id,
    activity.title,
    activity.pickup_label,
    activity.location,
    activity.start_time::text,
    activity.end_time::text,
    first_late_date.activity_date,
    'late-season'::text as notification_type
  from public.activities as activity
  left join lateral (
    select date_row.id, date_row.activity_date
    from public.activity_dates as date_row
    where date_row.activity_id = activity.id
      and date_row.is_active
      and date_row.activity_date >= public.activity_season_quarter_cutoff(activity.id)
    order by date_row.activity_date
    limit 1
  ) as first_late_date on true
  where activity.season_enabled
    and activity.season_late_enabled
    and activity.season_late_open_date is not null
    and activity.season_late_open_time is not null
    and activity.season_late_open_date >= (p_window_start at time zone 'Asia/Taipei')::date
    and activity.season_late_open_date <= (p_window_end at time zone 'Asia/Taipei')::date
    and ((activity.season_late_open_date + activity.season_late_open_time) at time zone 'Asia/Taipei') >= p_window_start
    and ((activity.season_late_open_date + activity.season_late_open_time) at time zone 'Asia/Taipei') < p_window_end

  union all

  select
    activity.id as activity_id,
    date_row.id as activity_date_id,
    activity.title,
    activity.pickup_label,
    activity.location,
    activity.start_time::text,
    activity.end_time::text,
    date_row.activity_date,
    'pickup'::text as notification_type
  from public.activity_dates as date_row
  join public.activities as activity on activity.id = date_row.activity_id
  where date_row.is_active
    and activity.pickup_open_days_before between 1 and 7
    and activity.pickup_open_time is not null
    and date_row.activity_date >= (p_window_start at time zone 'Asia/Taipei')::date
    and date_row.activity_date <= (p_window_end at time zone 'Asia/Taipei')::date + 7
    and ((date_row.activity_date - activity.pickup_open_days_before + activity.pickup_open_time) at time zone 'Asia/Taipei') >= p_window_start
    and ((date_row.activity_date - activity.pickup_open_days_before + activity.pickup_open_time) at time zone 'Asia/Taipei') < p_window_end;
$$;

revoke all on function public.activity_season_quarter_cutoff(bigint) from public;
grant execute on function public.activity_season_quarter_cutoff(bigint) to anon, authenticated, service_role;
revoke all on function public.season_plan_covers_date(text, date, date) from public;
grant execute on function public.season_plan_covers_date(text, date, date) to anon, authenticated, service_role;
revoke all on function public.season_plans_overlap(text, text) from public;
grant execute on function public.season_plans_overlap(text, text) to anon, authenticated, service_role;
revoke all on function public.write_registration_v3(uuid, jsonb) from public;
grant execute on function public.write_registration_v3(uuid, jsonb) to service_role;
revoke all on function public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint) from public;
grant execute on function public.list_group_activity_sessions(text, integer, timestamptz, date, timestamptz, bigint) to anon, authenticated, service_role;
revoke all on function public.count_past_participations(text, date, date) from public;
grant execute on function public.count_past_participations(text, date, date) to anon, authenticated, service_role;
revoke all on function public.write_activity_v3(bigint, jsonb) from public;
grant execute on function public.write_activity_v3(bigint, jsonb) to service_role;
revoke all on function public.list_registration_open_notification_candidates(timestamptz, timestamptz) from public;
grant execute on function public.list_registration_open_notification_candidates(timestamptz, timestamptz) to service_role;
