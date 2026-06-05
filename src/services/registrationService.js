import { invokeLineFunction } from '~/services/edgeFunctionClient'
import { supabase } from '~/utils/supabase'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const PUBLIC_REGISTRATION_FIELDS =
  'id, activity_id, activity_date, user_id, display_name, picture_url, self_count, self_added_at, guest_count, guests, status, leave_dates, rejoin_times, cancelled_members, created_at'

export async function invokeRegistrationAction(liffStore, body) {
  await invokeLineFunction(liffStore, 'registration-action', body)
}

export async function listRegistrationPayments(liffStore, activityId) {
  if (!liffStore.userId) return []
  try {
    const data = await invokeLineFunction(liffStore, 'registration-action', { action: 'list-registration-payments', activityId })
    return data?.payments || []
  } catch {
    return []
  }
}

export async function listSeasonRegistrations(activityId, statuses = ['active']) {
  const { data } = await supabase
    .from('public_registrations')
    .select(PUBLIC_REGISTRATION_FIELDS)
    .eq('activity_id', activityId)
    .is('activity_date', null)
    .in('status', statuses)
    .order('created_at', { ascending: true })
  return data || []
}

export async function listPickupRegistrations(activityId, activityDate, statuses = ['active', 'cancelled']) {
  const { data } = await supabase
    .from('public_registrations')
    .select(PUBLIC_REGISTRATION_FIELDS)
    .eq('activity_id', activityId)
    .eq('activity_date', activityDate)
    .in('status', statuses)
    .order('created_at', { ascending: true })
  return data || []
}

export async function listRegistrationsForLatestSpots(activityId, activityDate) {
  if (!ISO_DATE_PATTERN.test(activityDate || '')) return []

  const { data } = await supabase
    .from('public_registrations')
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
