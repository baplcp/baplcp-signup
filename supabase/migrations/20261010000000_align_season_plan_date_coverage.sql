-- A plan cannot cover a missing activity date. Keep the database rule aligned
-- with the frontend and Edge Function contract, including half-year plans.
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
    when p_activity_date is null then false
    when coalesce(p_season_plan, 'quarter') = 'half-year' then true
    when p_quarter_cutoff is null then false
    when p_season_plan = 'late-quarter' then p_activity_date >= p_quarter_cutoff
    else p_activity_date < p_quarter_cutoff
  end;
$$;
