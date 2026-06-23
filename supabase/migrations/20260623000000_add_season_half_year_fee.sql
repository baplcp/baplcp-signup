alter table activities
  add column if not exists season_half_year_fee_per_session numeric default 0;
