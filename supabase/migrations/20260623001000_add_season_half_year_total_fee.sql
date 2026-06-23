alter table activities
  add column if not exists season_half_year_total_fee numeric default 0;
