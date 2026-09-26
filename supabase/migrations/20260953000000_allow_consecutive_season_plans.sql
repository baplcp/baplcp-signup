-- 已報一季的人要能續報後季：同一賽季同一成員允許多筆有效季打報名，
-- 但方案涵蓋範圍不可重疊（一季 + 後季可以；半年與任何方案都重疊）。

drop index if exists public.registrations_active_season_member_unique;

create unique index registrations_active_season_member_plan_unique
  on public.registrations (season_id, member_id, (coalesce(season_plan, 'quarter')))
  where cancelled_at is null and activity_date_id is null;

-- write_registration_v3 在寫入前已鎖住賽季列，同一賽季的季打寫入會依序執行，
-- 這裡的檢查不會被併發請求繞過。
create or replace function public.prevent_overlapping_season_registrations()
returns trigger
language plpgsql
as $$
begin
  if new.activity_date_id is not null or new.cancelled_at is not null then
    return new;
  end if;

  if exists (
    select 1
    from public.registrations as registration
    where registration.season_id = new.season_id
      and registration.member_id = new.member_id
      and registration.activity_date_id is null
      and registration.cancelled_at is null
      and registration.id <> new.id
      and public.season_plans_overlap(registration.season_plan, new.season_plan)
  ) then
    raise exception 'season_plan_overlap' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_prevent_overlapping_season_plans on public.registrations;
create trigger registrations_prevent_overlapping_season_plans
  before insert or update of season_plan, cancelled_at, activity_date_id, member_id, season_id
  on public.registrations
  for each row
  execute function public.prevent_overlapping_season_registrations();
