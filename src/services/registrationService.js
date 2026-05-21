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

export function subscribeToRegistrationChanges(onChange) {
  return supabase.channel('registrations-live').on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, onChange).subscribe()
}

export function removeRegistrationSubscription(channel) {
  if (channel) supabase.removeChannel(channel)
}
