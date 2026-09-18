import { supabase } from '~/utils/supabase'
import { invokeLineFunction } from '~/services/edgeFunctionClient'
import { fetchActivityDates, groupActivityDates } from '~/services/activityDateService'

const ACTIVITY_FORM_FIELDS =
  'id, created_at, title, location, start_time, end_time, season_fee_per_session, pickup_fee_per_session, ac_fee, single_capacity, season_enabled, season_include_ac, season_total_fee, season_capacity, season_open_date, season_open_time, season_deadline_type, season_close_date, season_close_time, pickup_open_days_before, pickup_open_time, pickup_deadline_type, pickup_close_days_before, pickup_close_time, game_type, ac_enabled, ac_fee_per_session, pickup_label, reminder_enabled, reminder_days_before, reminder_time, season_half_year_total_fee, season_half_year_fee_per_session'

async function hydrateActivityDates(activities) {
  if (!activities?.length) return activities || []

  const datesByActivityId = groupActivityDates(await fetchActivityDates(activities.map(activity => activity.id)))
  return activities.map(activity => ({ ...activity, dates: datesByActivityId.get(activity.id) || [] }))
}

async function fetchActivities(query) {
  const { data, error } = await query
  if (error) throw error
  return hydrateActivityDates(data || [])
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
  const activities = await fetchActivities(supabase.from('activities').select(ACTIVITY_FORM_FIELDS).eq('id', id))
  if (!activities.length) throw new Error('activity_not_found')
  return activities[0]
}

export async function listManagedActivities() {
  return fetchActivities(supabase.from('activities').select('id, title').order('created_at', { ascending: false }))
}

export async function listHomeActivityCandidates() {
  return fetchActivities(supabase.from('activities').select('id, end_time').order('created_at', { ascending: false }).limit(20))
}

export async function listSeasonActivities() {
  return fetchActivities(
    supabase
      .from('activities')
      .select('id, title, season_open_date, season_open_time, season_close_date, season_close_time, season_deadline_type')
      .eq('season_enabled', true)
      .order('created_at', { ascending: false })
  )
}

export async function listSeasonActivitiesForRefund() {
  return fetchActivities(supabase.from('activities').select('id, title, season_fee_per_session').eq('season_enabled', true).order('created_at', { ascending: false }))
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
