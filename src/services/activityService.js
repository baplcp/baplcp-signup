import { supabase } from '~/utils/supabase'
import { invokeLineFunction } from '~/services/edgeFunctionClient'
import { fetchActivityDates, groupActivityDates } from '~/services/activityDateService'
import { listSeasonPageRegistrations } from '~/services/registrationService'

const ACTIVITY_FORM_FIELDS =
  'id, created_at, title, location, start_time, end_time, season_fee_per_session, pickup_fee_per_session, ac_fee, single_capacity, season_enabled, season_include_ac, season_total_fee, season_capacity, season_open_date, season_open_time, season_deadline_type, season_close_date, season_close_time, season_late_enabled, season_late_total_fee, season_late_open_date, season_late_open_time, season_late_deadline_type, season_late_close_date, season_late_close_time, pickup_open_days_before, pickup_open_time, pickup_deadline_type, pickup_close_days_before, pickup_close_time, game_type, ac_enabled, ac_fee_per_session, pickup_label, reminder_enabled, reminder_days_before, reminder_time, season_half_year_total_fee, season_half_year_fee_per_session'

// 季打頁不會顯示單場臨打資訊，避免沿用 get_activity_page 而取回當日臨打與群外名單。
const SEASON_SIGNUP_FIELDS =
  'id, title, location, start_time, end_time, season_fee_per_session, season_half_year_fee_per_session, ac_fee, single_capacity, season_total_fee, season_half_year_total_fee, season_capacity, season_open_date, season_open_time, season_close_date, season_close_time, season_late_enabled, season_late_total_fee, season_late_open_date, season_late_open_time, season_late_close_date, season_late_close_time, ac_enabled'

async function fetchSeasonSignupDates(activityId) {
  const { data, error } = await supabase.from('activity_dates').select('activity_date').eq('season_id', activityId).eq('is_active', true).order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

async function hydrateActivityDates(activities, { includeActivityDateRecords = false } = {}) {
  if (!activities?.length) return activities || []

  const activityDates = await fetchActivityDates(activities.map(activity => activity.id))
  const datesByActivityId = groupActivityDates(activityDates)
  const activityDateRecordsByActivityId = includeActivityDateRecords
    ? activityDates.reduce((recordsByActivityId, activityDate) => {
        const records = recordsByActivityId.get(activityDate.season_id) || []
        records.push(activityDate)
        recordsByActivityId.set(activityDate.season_id, records)
        return recordsByActivityId
      }, new Map())
    : null

  return activities.map(activity => ({
    ...activity,
    dates: datesByActivityId.get(activity.id) || [],
    ...(includeActivityDateRecords ? { activityDates: activityDateRecordsByActivityId.get(activity.id) || [] } : {}),
  }))
}

async function fetchActivities(query, options) {
  const { data, error } = await query
  if (error) throw error
  return hydrateActivityDates(data || [], options)
}

async function invokeActivityAdmin(liffStore, body) {
  const data = await invokeLineFunction(liffStore, 'activity-admin', body)
  return data?.data ?? data
}

export async function createActivity(liffStore, payload) {
  return invokeActivityAdmin(liffStore, { action: 'create', payload })
}

export async function updateActivity(liffStore, id, payload) {
  return invokeActivityAdmin(liffStore, { action: 'update', id, payload })
}

export async function deleteActivity(liffStore, id) {
  return invokeActivityAdmin(liffStore, { action: 'delete', id })
}

export async function getActivity(id) {
  const activities = await fetchActivities(supabase.from('seasons').select(ACTIVITY_FORM_FIELDS).eq('id', id))
  if (!activities.length) throw new Error('activity_not_found')
  return activities[0]
}

export async function listManagedActivities() {
  return fetchActivities(supabase.from('seasons').select('id, title').order('created_at', { ascending: false }))
}

export async function getLatestActivitySession(now = new Date()) {
  const { data, error } = await supabase.rpc('list_activities', {
    p_segment: 'upcoming',
    p_limit: 1,
    p_now: now.toISOString(),
    p_cursor_activity_date: null,
    p_cursor_created_at: null,
    p_cursor_activity_date_id: null,
  })
  if (error) throw error
  return data?.[0] || null
}

export async function listSeasonActivities() {
  const { data, error } = await supabase
    .from('seasons')
    .select('id, title, season_open_date, season_open_time, season_close_date, season_close_time, season_deadline_type, activity_dates(count)')
    .eq('season_enabled', true)
    .eq('activity_dates.is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map(({ activity_dates: activityDates, ...activity }) => ({
    ...activity,
    sessionCount: activityDates?.[0]?.count ?? 0,
  }))
}

export async function listSeasonActivitiesForRefund() {
  return fetchActivities(supabase.from('seasons').select('id, title, season_fee_per_session').eq('season_enabled', true).order('created_at', { ascending: false }))
}

export async function getActivityPage(activityId, activityDateId = null) {
  const hasActivityId = activityId !== null && activityId !== undefined && activityId !== ''
  const parsedActivityId = Number(activityId)
  if (hasActivityId && !Number.isSafeInteger(parsedActivityId)) return null

  const hasActivityDateId = activityDateId !== null && activityDateId !== undefined && activityDateId !== ''
  const parsedActivityDateId = Number(activityDateId)
  const { data, error } = await supabase.rpc('get_activity_page', {
    p_activity_id: hasActivityId ? parsedActivityId : null,
    p_activity_date_id: hasActivityDateId && Number.isSafeInteger(parsedActivityDateId) ? parsedActivityDateId : null,
  })
  if (error) throw error

  return data || null
}

export async function getSeasonSignupPage(activityId) {
  const parsedActivityId = Number(activityId)
  if (!Number.isSafeInteger(parsedActivityId)) return null

  const { data: activity, error } = await supabase.from('seasons').select(SEASON_SIGNUP_FIELDS).eq('id', parsedActivityId).maybeSingle()
  if (error) throw error
  if (!activity) return null

  const [dates, seasonRegistrations] = await Promise.all([fetchSeasonSignupDates(activity.id), listSeasonPageRegistrations(activity.id)])

  return {
    activity: {
      ...activity,
      dates: dates.map(date => date.activity_date),
    },
    season_registrations: seasonRegistrations,
  }
}
