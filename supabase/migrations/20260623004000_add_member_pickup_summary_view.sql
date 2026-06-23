create or replace view member_pickup_summary as
select
  m.user_id,
  m.display_name,
  r.activity_id,
  count(r.id) as pickup_count,
  array_agg(r.activity_date order by r.activity_date) as pickup_dates
from members m
join registrations r
  on r.user_id = m.user_id
  and r.activity_date is not null
  and r.status = 'active'
group by m.user_id, m.display_name, r.activity_id;
