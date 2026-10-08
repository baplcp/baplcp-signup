-- Only LINE-verified Edge Functions may request a member's participation count.
revoke execute on function public.count_past_participations(text, date, date)
  from public, anon, authenticated;
grant execute on function public.count_past_participations(text, date, date)
  to service_role;
