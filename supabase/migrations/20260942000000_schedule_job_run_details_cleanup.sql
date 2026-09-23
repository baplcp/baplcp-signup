select cron.schedule(
  'job-run-details-cleanup',
  '0 0 * * *',
  $$
    delete from cron.job_run_details
    where end_time < now() - interval '1 day'
  $$
);

-- pg_net stores HTTP response bodies for scheduled Edge Function calls. These
-- are operational logs rather than application data, so retain only one day
-- for troubleshooting.
delete from net._http_response
where created < now() - interval '1 day';

select cron.schedule(
  'http-response-cleanup',
  '10 0 * * *',
  $$
    delete from net._http_response
    where created < now() - interval '1 day'
  $$
);
