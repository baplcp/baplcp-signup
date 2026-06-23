alter table registrations
  add column if not exists season_plan text default 'quarter';
