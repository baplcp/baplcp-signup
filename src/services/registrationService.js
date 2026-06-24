import { invokeLineFunction } from '~/services/edgeFunctionClient'
import { supabase } from '~/utils/supabase'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export async function invokeRegistrationAction(liffStore, body) {
  await invokeLineFunction(liffStore, 'registration-action', body)
}

export async function listSeasonRegistrations(activityId, statuses = ['active']) {
  const { data } = await supabase.from('registrations').select('*').eq('activity_id', activityId).is('activity_date', null).in('status', statuses).order('created_at', { ascending: true })
  return data || []
}

export async function listPickupRegistrations(activityId, activityDate, statuses = ['active', 'cancelled']) {
  const { data } = await supabase.from('registrations').select('*').eq('activity_id', activityId).eq('activity_date', activityDate).in('status', statuses).order('created_at', { ascending: true })
  return data || []
}

export async function listRegistrationsForLatestSpots(activityId, activityDate) {
  if (!ISO_DATE_PATTERN.test(activityDate || '')) return []

  const { data } = await supabase
    .from('registrations')
    .select('self_count, guest_count')
    .eq('activity_id', activityId)
    .or(`activity_date.eq.${activityDate},activity_date.is.null`)
    .eq('status', 'active')
  return data || []
}

export async function countPastParticipations(userId) {
  if (!userId) return 0
  const today = new Date().toISOString().split('T')[0]

  const { count: pickupCount } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('self_count', 0)
    .not('activity_date', 'is', null)
    .lt('activity_date', today)

  const { data: seasonRegs } = await supabase
    .from('registrations')
    .select('activity_id, leave_dates')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('self_count', 0)
    .is('activity_date', null)

  let seasonCount = 0
  if (seasonRegs && seasonRegs.length > 0) {
    const activityIds = [...new Set(seasonRegs.map(r => r.activity_id))]
    const { data: activities } = await supabase.from('activities').select('id, dates').in('id', activityIds)
    const datesMap = Object.fromEntries((activities || []).map(a => [a.id, a.dates || []]))
    for (const reg of seasonRegs) {
      const leaveDates = reg.leave_dates || []
      const attended = (datesMap[reg.activity_id] || []).filter(d => d < today && !leaveDates.includes(d))
      seasonCount += attended.length
    }
  }

  return (pickupCount || 0) + seasonCount
}

export function subscribeToRegistrationChanges(onChange) {
  return supabase.channel('registrations-live').on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, onChange).subscribe()
}

export function removeRegistrationSubscription(channel) {
  if (channel) supabase.removeChannel(channel)
}
