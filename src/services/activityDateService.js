import { supabase } from '~/utils/supabase'

export async function fetchActivityDates(activityIds, { activeOnly = true } = {}) {
  const ids = [...new Set((activityIds || []).filter(Boolean))]
  if (!ids.length) return []

  let query = supabase.from('activity_dates').select('id, season_id, activity_date').in('season_id', ids)
  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query.order('season_id', { ascending: true }).order('activity_date', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchActivityDatesByIds(activityDateIds) {
  const ids = [...new Set((activityDateIds || []).filter(Boolean))]
  if (!ids.length) return []

  const { data, error } = await supabase.from('activity_dates').select('id, season_id, activity_date').in('id', ids)
  if (error) throw error
  return data || []
}

export async function fetchActivityDateId(activityId, activityDate) {
  if (!activityId || !activityDate) return null

  const { data, error } = await supabase.from('activity_dates').select('id').eq('season_id', activityId).eq('activity_date', activityDate).maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function fetchActivityDatesInRange(startDate, endDate) {
  const { data, error } = await supabase.from('activity_dates').select('id, season_id, activity_date').gte('activity_date', startDate).lt('activity_date', endDate)
  if (error) throw error
  return data || []
}

export function groupActivityDates(activityDates) {
  return (activityDates || []).reduce((datesByActivityId, activityDate) => {
    const dates = datesByActivityId.get(activityDate.season_id) || []
    dates.push(activityDate.activity_date)
    datesByActivityId.set(activityDate.season_id, dates)
    return datesByActivityId
  }, new Map())
}
