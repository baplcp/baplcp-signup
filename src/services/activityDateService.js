import { supabase } from '~/utils/supabase'

export async function fetchActivityDates(activityIds, { activeOnly = true } = {}) {
  const ids = [...new Set((activityIds || []).filter(Boolean))]
  if (!ids.length) return []

  let query = supabase.from('activity_dates').select('id, activity_id, activity_date, sort_order').in('activity_id', ids)
  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query.order('activity_id', { ascending: true }).order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchActivityDatesByIds(activityDateIds) {
  const ids = [...new Set((activityDateIds || []).filter(Boolean))]
  if (!ids.length) return []

  const { data, error } = await supabase.from('activity_dates').select('id, activity_id, activity_date, sort_order').in('id', ids)
  if (error) throw error
  return data || []
}

export function groupActivityDates(activityDates) {
  return (activityDates || []).reduce((datesByActivityId, activityDate) => {
    const dates = datesByActivityId.get(activityDate.activity_id) || []
    dates.push(activityDate.activity_date)
    datesByActivityId.set(activityDate.activity_id, dates)
    return datesByActivityId
  }, new Map())
}
