-- Recalculate persisted season totals from the canonical activity-date collection.
-- The Edge Function applies the same rule to all future activity writes.

with first_dates as (
  select
    activity_id,
    min(activity_date) as first_date,
    count(*) as half_year_session_count
  from public.activity_dates
  where is_active
  group by activity_id
), totals as (
  select
    activity_date.activity_id,
    count(*) filter (
      where activity_date.activity_date < (date_trunc('month', first_dates.first_date) + interval '3 months')::date
    ) as quarter_session_count,
    first_dates.half_year_session_count
  from public.activity_dates as activity_date
  join first_dates on first_dates.activity_id = activity_date.activity_id
  where activity_date.is_active
  group by activity_date.activity_id, first_dates.first_date, first_dates.half_year_session_count
)
update public.activities as activity
set
  season_total_fee = totals.quarter_session_count * (
    coalesce(activity.season_fee_per_session, 0) + case when coalesce(activity.season_include_ac, false) then coalesce(activity.ac_fee, 0) else 0 end
  ),
  season_half_year_total_fee = totals.half_year_session_count * (
    coalesce(activity.season_half_year_fee_per_session, 0) + case when coalesce(activity.season_include_ac, false) then coalesce(activity.ac_fee, 0) else 0 end
  )
from totals
where activity.id = totals.activity_id;

update public.activities as activity
set
  season_total_fee = 0,
  season_half_year_total_fee = 0
where not exists (
  select 1
  from public.activity_dates as activity_date
  where activity_date.activity_id = activity.id
    and activity_date.is_active
);
