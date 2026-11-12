-- Season membership is derived from active season registrations during profile sync.
drop trigger if exists registrations_sync_member_season_status on public.registrations;
drop function if exists public.sync_member_season_status_from_registrations();

alter table public.members drop column if exists is_season;
