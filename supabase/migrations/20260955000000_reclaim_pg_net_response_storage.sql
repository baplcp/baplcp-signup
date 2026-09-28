-- `pg_net` already expires HTTP response records according to `pg_net.ttl`
-- (six hours by default). The extra daily cleanup duplicated that work.
do $$
declare
  response_cleanup_job_id bigint;
begin
  select jobid
    into response_cleanup_job_id
  from cron.job
  where jobname = 'http-response-cleanup';

  if response_cleanup_job_id is not null then
    perform cron.unschedule(response_cleanup_job_id);
  end if;
end;
$$;
