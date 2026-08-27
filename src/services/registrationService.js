import { invokeLineFunction } from '~/services/edgeFunctionClient'
import { fetchActivityDates, fetchActivityDatesByIds } from '~/services/activityDateService'
import { supabase } from '~/utils/supabase'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const REGISTRATION_FIELDS =
  'id, activity_id, activity_date, activity_date_id, user_id, display_name, picture_url, self_count, guest_count, status, created_at, self_added_at, paid_court, paid_ac, season_plan'

function groupBy(items, key) {
  return (items || []).reduce((grouped, item) => {
    const values = grouped.get(item[key]) || []
    values.push(item)
    grouped.set(item[key], values)
    return grouped
  }, new Map())
}

async function fetchRegistrationGuests(registrationIds) {
  if (!registrationIds.length) return new Map()

  const { data, error } = await supabase
    .from('registration_guests')
    .select('registration_id, guest_position, display_name, gender, joined_at, paid_court, paid_ac')
    .in('registration_id', registrationIds)
    .order('guest_position', { ascending: true })
  if (error) throw error

  return groupBy(data, 'registration_id')
}

async function fetchRegistrationDateStates(registrationIds) {
  if (!registrationIds.length) return new Map()

  const { data: states, error } = await supabase
    .from('season_registration_date_statuses')
    .select('registration_id, activity_date_id, is_on_leave, leave_submitted_at, rejoined_at')
    .in('registration_id', registrationIds)
  if (error) throw error

  const activityDates = await fetchActivityDatesByIds((states || []).map(state => state.activity_date_id))
  const datesById = new Map(activityDates.map(activityDate => [activityDate.id, activityDate.activity_date]))

  return (states || []).reduce((statesByRegistrationId, state) => {
    const activityDate = datesById.get(state.activity_date_id)
    if (!activityDate) return statesByRegistrationId

    const registrationState = statesByRegistrationId.get(state.registration_id) || {
      leave_dates: [],
      leave_times: {},
      rejoin_times: {},
    }
    if (state.is_on_leave) registrationState.leave_dates.push(activityDate)
    if (state.leave_submitted_at) registrationState.leave_times[activityDate] = state.leave_submitted_at
    if (state.rejoined_at) registrationState.rejoin_times[activityDate] = state.rejoined_at
    statesByRegistrationId.set(state.registration_id, registrationState)
    return statesByRegistrationId
  }, new Map())
}

async function fetchCancellationSnapshots(registrationIds) {
  if (!registrationIds.length) return new Map()

  const { data, error } = await supabase
    .from('registration_cancellation_events')
    .select('registration_id, legacy_source, legacy_position, display_name, picture_url, added_by, participant_added_at')
    .in('registration_id', registrationIds)
    .eq('legacy_source', 'cancelled_members')
    .order('legacy_source', { ascending: true })
    .order('legacy_position', { ascending: true })
  if (error) throw error

  return groupBy(data, 'registration_id')
}

function toGuest(guest) {
  return {
    name: guest.display_name || '',
    gender: guest.gender || '',
    added_at: guest.joined_at || null,
    paid_court: guest.paid_court ?? false,
    paid_ac: guest.paid_ac ?? false,
  }
}

function toCancellationSnapshot(cancellation) {
  const name = cancellation.display_name || '群外'
  return {
    name,
    badge: name.charAt(0),
    image: cancellation.picture_url || null,
    time: cancellation.participant_added_at || null,
    addedBy: cancellation.added_by || null,
  }
}

async function hydrateRegistrations(registrations, { includeGuests = true, includeCancellations = true } = {}) {
  if (!registrations?.length) return registrations || []

  const registrationIds = registrations.map(registration => registration.id)
  const [guestsByRegistrationId, statesByRegistrationId, cancellationsByRegistrationId] = await Promise.all([
    includeGuests ? fetchRegistrationGuests(registrationIds) : Promise.resolve(new Map()),
    fetchRegistrationDateStates(registrationIds),
    includeCancellations ? fetchCancellationSnapshots(registrationIds) : Promise.resolve(new Map()),
  ])

  return registrations.map(registration => {
    const guests = (guestsByRegistrationId.get(registration.id) || []).map(toGuest)
    const dateState = statesByRegistrationId.get(registration.id) || { leave_dates: [], leave_times: {}, rejoin_times: {} }
    const cancelledMembers = (cancellationsByRegistrationId.get(registration.id) || []).map(toCancellationSnapshot)

    return {
      ...registration,
      ...(includeGuests ? { guests, guest_count: guests.length } : {}),
      ...dateState,
      ...(includeCancellations ? { cancelled_members: cancelledMembers } : {}),
    }
  })
}

async function listRegistrations(query, options) {
  const { data, error } = await query
  if (error) throw error
  return hydrateRegistrations(data || [], options)
}

export async function invokeRegistrationAction(liffStore, body) {
  await invokeLineFunction(liffStore, 'registration-action', body)
}

export async function listSeasonRegistrations(activityId, statuses = ['active']) {
  return listRegistrations(
    supabase.from('registrations').select(REGISTRATION_FIELDS).eq('activity_id', activityId).is('activity_date', null).in('status', statuses).order('created_at', { ascending: true })
  )
}

export async function listPickupRegistrations(activityId, activityDate, statuses = ['active', 'cancelled']) {
  return listRegistrations(
    supabase.from('registrations').select(REGISTRATION_FIELDS).eq('activity_id', activityId).eq('activity_date', activityDate).in('status', statuses).order('created_at', { ascending: true })
  )
}

export async function listRegistrationsForLatestSpots(activityId, activityDate) {
  if (!ISO_DATE_PATTERN.test(activityDate || '')) return []

  return listRegistrations(
    supabase
      .from('registrations')
      .select('id, activity_date, self_count, guest_count')
      .eq('activity_id', activityId)
      .or(`activity_date.eq.${activityDate},activity_date.is.null`)
      .eq('status', 'active'),
    { includeGuests: false, includeCancellations: false }
  )
}

export async function listRegistrationsForActivitySpots(activityId) {
  return listRegistrations(supabase.from('registrations').select('id, activity_date, self_count, guest_count').eq('activity_id', activityId).eq('status', 'active'), {
    includeGuests: false,
    includeCancellations: false,
  })
}

const PARTICIPATION_COUNT_START_DATE = '2026-07-03'

export async function countPastParticipations(userId) {
  if (!userId) return 0
  const today = new Date().toISOString().split('T')[0]

  const { count: pickupCount, error: pickupError } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('self_count', 0)
    .not('activity_date', 'is', null)
    .gte('activity_date', PARTICIPATION_COUNT_START_DATE)
    .lt('activity_date', today)
  if (pickupError) throw pickupError

  const { data: seasonRegistrations, error: seasonError } = await supabase
    .from('registrations')
    .select('id, activity_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('self_count', 0)
    .is('activity_date', null)
  if (seasonError) throw seasonError

  if (!seasonRegistrations?.length) return pickupCount || 0

  const [activityDates, statesByRegistrationId] = await Promise.all([
    fetchActivityDates([...new Set(seasonRegistrations.map(registration => registration.activity_id))], { activeOnly: false }),
    fetchRegistrationDateStates(seasonRegistrations.map(registration => registration.id)),
  ])
  const datesByActivityId = groupBy(activityDates, 'activity_id')

  const seasonCount = seasonRegistrations.reduce((count, registration) => {
    const leaveDates = new Set(statesByRegistrationId.get(registration.id)?.leave_dates || [])
    const attendedDates = (datesByActivityId.get(registration.activity_id) || []).filter(
      activityDate => activityDate.activity_date >= PARTICIPATION_COUNT_START_DATE && activityDate.activity_date < today && !leaveDates.has(activityDate.activity_date)
    )
    return count + attendedDates.length
  }, 0)

  return (pickupCount || 0) + seasonCount
}

export function subscribeToRegistrationChanges(onChange) {
  return supabase.channel('registrations-live').on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, onChange).subscribe()
}

export function removeRegistrationSubscription(channel) {
  if (channel) supabase.removeChannel(channel)
}
