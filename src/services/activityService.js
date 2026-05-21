import { supabase } from '~/utils/supabase'
import { invokeLineFunction } from '~/services/edgeFunctionClient'

export const ACTIVITY_DETAIL_FIELDS =
  'id, title, location, dates, start_time, end_time, single_capacity, pickup_fee_per_session, season_fee_per_session, season_total_fee, season_capacity, season_enabled, ac_enabled, ac_fee, pickup_open_days_before, pickup_open_time, season_open_date, season_open_time, season_close_date, season_close_time'

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
  const { data, error } = await supabase.from('activities').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function listManagedActivities() {
  const { data, error } = await supabase.from('activities').select('id, title, dates').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function fetchActivityDetail(id) {
  if (id) {
    return supabase.from('activities').select(ACTIVITY_DETAIL_FIELDS).eq('id', id).single()
  }

  return supabase.from('activities').select(ACTIVITY_DETAIL_FIELDS).order('created_at', { ascending: false }).limit(1).single()
}
