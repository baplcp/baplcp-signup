import { invokeLineFunction } from '~/services/edgeFunctionClient'
import { fetchActivityDates, fetchActivityDatesByIds } from '~/services/activityDateService'
import { supabase } from '~/utils/supabase'
import { getTaiwanDateString } from '~/utils/taiwanDate'

const REGISTRATION_FIELDS =
  'id, season_id, activity_date_id, member_id, cancelled_at, created_at, paid_court, paid_ac, season_plan, member:members!registrations_member_id_fkey(user_id, display_name, picture_url, gender)'

function guestOwnerKey(activityDateId, memberId) {
  return `${activityDateId}:${memberId}`
}

async function fetchRegistrationGuests(activityDateIds) {
  if (!activityDateIds.length) return new Map()

  const { data, error } = await supabase
    .from('registration_guests')
    .select('id, activity_date_id, invited_by, display_name, gender, created_at, cancelled_at, paid_court, paid_ac')
    .in('activity_date_id', activityDateIds)
    .order('created_at', { ascending: true })
  if (error) throw error

  return (data || []).reduce((grouped, guest) => {
    const key = guestOwnerKey(guest.activity_date_id, guest.invited_by)
    const values = grouped.get(key) || []
    values.push(guest)
    grouped.set(key, values)
    return grouped
  }, new Map())
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

function toGuest(guest) {
  return {
    id: guest.id,
    name: guest.display_name || '',
    gender: guest.gender || '',
    created_at: guest.created_at || null,
    cancelled_at: guest.cancelled_at || null,
    paid_court: guest.paid_court ?? false,
    paid_ac: guest.paid_ac ?? false,
  }
}

function withMemberProfile(registration) {
  const member = Array.isArray(registration.member) ? registration.member[0] : registration.member
  return {
    ...registration,
    user_id: member?.user_id || null,
    display_name: member?.display_name || null,
    picture_url: member?.picture_url || null,
    member_gender: member?.gender || null,
  }
}

async function hydrateRegistrations(registrations, { includeGuests = true, includeDateStates = true, includeActivityDates = true } = {}) {
  if (!registrations?.length) return registrations || []

  const registrationIds = registrations.map(registration => registration.id)
  const [guestsByRegistrationId, statesByRegistrationId, registrationActivityDates] = await Promise.all([
    includeGuests ? fetchRegistrationGuests(registrations.map(registration => registration.activity_date_id).filter(Boolean)) : Promise.resolve(new Map()),
    includeDateStates ? fetchRegistrationDateStates(registrationIds) : Promise.resolve(new Map()),
    includeActivityDates ? fetchActivityDatesByIds(registrations.map(registration => registration.activity_date_id)) : Promise.resolve([]),
  ])
  const registrationActivityDatesById = new Map(registrationActivityDates.map(activityDate => [activityDate.id, activityDate.activity_date]))

  return registrations.map(registration => {
    const guests = (guestsByRegistrationId.get(guestOwnerKey(registration.activity_date_id, registration.member_id)) || []).map(toGuest)
    const dateState = statesByRegistrationId.get(registration.id) || { leave_dates: [], leave_times: {}, rejoin_times: {} }

    return {
      ...withMemberProfile(registration),
      activity_date: registration.activity_date_id ? registrationActivityDatesById.get(registration.activity_date_id) || null : null,
      ...(includeGuests ? { guests } : {}),
      is_self_registration: true,
      ...dateState,
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

export async function getActivityRegistration(registrationId) {
  if (!registrationId) return null

  const { data, error } = await supabase.rpc('get_activity_registration', {
    p_registration_id: registrationId,
  })
  if (error) throw error
  return data || null
}

export async function listSeasonRegistrations(activityId) {
  return listRegistrations(
    supabase.from('registrations').select(REGISTRATION_FIELDS).eq('season_id', activityId).is('activity_date_id', null).is('cancelled_at', null).order('created_at', { ascending: true })
  )
}

// 季打頁需同時顯示已取消名單，因此保留取消紀錄；不會讀取任何單場臨打或群外資料。
export async function listSeasonPageRegistrations(activityId) {
  return listRegistrations(supabase.from('registrations').select(REGISTRATION_FIELDS).eq('season_id', activityId).is('activity_date_id', null).order('created_at', { ascending: true }), {
    includeGuests: false,
    includeDateStates: false,
    includeActivityDates: false,
  })
}

export async function listGroupActivitySessions(segment, { limit, cursor, now }) {
  const { data, error } = await supabase.rpc('list_activities', {
    p_segment: segment,
    p_limit: limit,
    p_now: now.toISOString(),
    p_cursor_activity_date: cursor?.activity_date ?? null,
    p_cursor_created_at: cursor?.activity_created_at ?? null,
    p_cursor_activity_date_id: cursor?.activity_date_id ?? null,
  })
  if (error) throw error
  return data || []
}

export const PARTICIPATION_COUNT_START_DATE = '2026-07-03'

const MY_RECORD_ACTIVITY_FIELDS = 'id, title, end_time, ac_enabled, ac_fee, season_fee_per_session, season_half_year_fee_per_session'

// 我的紀錄：一次取回會員自己的報名、所屬活動、活動日期與季打請假狀態，出席與退費由 composable 計算。
export async function listMyRecordSources(userId) {
  const empty = { registrations: [], activities: [], seasonActivityDates: [], pickupActivityDates: [], leaveDates: [] }
  if (!userId) return empty

  const { data: member, error: memberError } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle()
  if (memberError) throw memberError
  if (!member) return empty

  const { data: registrations, error: registrationError } = await supabase
    .from('registrations')
    .select('id, season_id, activity_date_id, paid_court, paid_ac, season_plan, created_at')
    .eq('member_id', member.id)
    .is('cancelled_at', null)
  if (registrationError) throw registrationError
  if (!registrations?.length) return empty

  const activityIds = [...new Set(registrations.map(registration => registration.season_id))]
  const seasonRegistrationIds = registrations.filter(registration => !registration.activity_date_id).map(registration => registration.id)

  const [activitiesResult, seasonActivityDates, pickupActivityDates, leaveStatesResult] = await Promise.all([
    supabase.from('seasons').select(MY_RECORD_ACTIVITY_FIELDS).in('id', activityIds),
    fetchActivityDates(registrations.filter(registration => !registration.activity_date_id).map(registration => registration.season_id)),
    fetchActivityDatesByIds(registrations.map(registration => registration.activity_date_id)),
    seasonRegistrationIds.length
      ? supabase.from('season_registration_date_statuses').select('registration_id, activity_date_id').in('registration_id', seasonRegistrationIds).eq('is_on_leave', true)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (activitiesResult.error) throw activitiesResult.error
  if (leaveStatesResult.error) throw leaveStatesResult.error

  // 退役日期仍保留請假紀錄，與主揪退費頁一致，因此另外依 id 取回日期。
  const leaveStates = leaveStatesResult.data || []
  const leaveActivityDates = await fetchActivityDatesByIds(leaveStates.map(state => state.activity_date_id))
  const leaveDatesById = new Map(leaveActivityDates.map(activityDate => [activityDate.id, activityDate.activity_date]))

  return {
    registrations,
    activities: activitiesResult.data || [],
    seasonActivityDates,
    pickupActivityDates,
    leaveDates: leaveStates.map(state => ({ registrationId: state.registration_id, activityDate: leaveDatesById.get(state.activity_date_id) })).filter(leave => leave.activityDate),
  }
}

export async function countPastParticipations(userId) {
  if (!userId) return 0
  const { data, error } = await supabase.rpc('count_past_participations', {
    p_user_id: userId,
    p_start_date: PARTICIPATION_COUNT_START_DATE,
    p_end_date: getTaiwanDateString(),
  })
  if (error) throw error
  return Number(data || 0)
}

export function subscribeToRegistrationChanges(activityId, onChange, { includeGuests = true, seasonOnly = false } = {}) {
  if (!activityId) return null

  const channel = supabase.channel(`registrations-live-${activityId}`)
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `season_id=eq.${activityId}` }, change => {
    const registration = change.new?.activity_date_id !== undefined ? change.new : change.old
    if (!seasonOnly || registration?.activity_date_id == null) onChange(change)
  })
  if (includeGuests) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'registration_guests', filter: `season_id=eq.${activityId}` }, onChange)
  return channel.subscribe()
}

export function removeRegistrationSubscription(channel) {
  if (channel) supabase.removeChannel(channel)
}
