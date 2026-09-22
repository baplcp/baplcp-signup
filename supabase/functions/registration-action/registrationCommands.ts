import { fetchActivityDateId, fetchSeasonRegistrationDateStatuses } from '../_shared/normalized-collection-data.ts'
import { addTaiwanDays, parseTaiwanDateTime } from '../_shared/taiwan-date.ts'
import { parseSaveRegistrationInput, parseSeasonLeaveInput } from '../_shared/input-validation.ts'
import {
  findRegistration,
  getActivityForRegistration,
  setSeasonRegistrationDateStatus,
  writeRegistration,
  writeRegistrationGuests,
  writeRegistrationWithRetry,
  type Registration,
} from './registrationRepository.ts'

export type RegistrationCommandContext = {
  supabase: any
  memberId: string
  activityId: string | number
  submitTime: string
  now: Date
  isAdmin: boolean
}

export type RegistrationCommandResult = { ok: true } | { error: string; status: number }

const MEMBER_GUEST_LIMIT = 2

function selfRegistrationPayload(activityId: string | number, activityDateId: number | null, memberId: string, seasonPlan?: string) {
  return { activity_id: activityId, activity_date_id: activityDateId, member_id: memberId, ...(seasonPlan ? { season_plan: seasonPlan } : {}) }
}

function guestPayload(activityId: string | number, activityDateId: number, memberId: string, guests: Array<{ id?: string; name: string; gender: string }>, isAdmin: boolean) {
  return { p_activity_id: Number(activityId), p_activity_date_id: activityDateId, p_invited_by: memberId, p_guests: guests, p_invitation_limit: isAdmin ? null : MEMBER_GUEST_LIMIT }
}

function assertSeasonEnabled(activity: Registration) {
  if (!activity.season_enabled) throw new Error('season_disabled')
}

function assertRegistrationWindow(activity: Registration, activityDate: string | null, now: Date, isAdmin = false) {
  if (activityDate === null) {
    assertSeasonEnabled(activity)
    if (activity.season_open_date && activity.season_open_time && now < parseTaiwanDateTime(activity.season_open_date, activity.season_open_time)) throw new Error('registration_not_open')
    if (!isAdmin && activity.season_close_date && activity.season_close_time && now >= parseTaiwanDateTime(activity.season_close_date, activity.season_close_time))
      throw new Error('registration_closed')
    return
  }
  if (activity.pickup_open_days_before != null && activity.pickup_open_time) {
    const openDate = addTaiwanDays(activityDate, -Number(activity.pickup_open_days_before))
    if (now < parseTaiwanDateTime(openDate, activity.pickup_open_time)) throw new Error('registration_not_open')
  }
  if (!isAdmin && activity.pickup_deadline_type === 'custom' && activity.pickup_close_days_before != null && activity.pickup_close_time) {
    const closeDate = addTaiwanDays(activityDate, -Number(activity.pickup_close_days_before))
    if (now >= parseTaiwanDateTime(closeDate, activity.pickup_close_time)) throw new Error('registration_closed')
  }
}

export async function saveRegistration(context: RegistrationCommandContext, body: Record<string, any>): Promise<RegistrationCommandResult> {
  const { supabase, memberId, activityId, submitTime, now, isAdmin } = context
  const { activityDate, selfCount, guestCount, guests } = parseSaveRegistrationInput(body, isAdmin ? Number.MAX_SAFE_INTEGER : MEMBER_GUEST_LIMIT)
  const normalizedGuests = guests.slice(0, guestCount)
  const activity = await getActivityForRegistration(supabase, activityId)
  if (activityDate === null) assertSeasonEnabled(activity)
  const activityDateId = activityDate === null ? null : await fetchActivityDateId(supabase, activityId, activityDate)
  if (activityDate !== null && activityDateId === null) return { error: 'activity_date_not_found', status: 404 }
  const findActiveSelf = () => findRegistration(supabase, { activityId, memberId, activityDateId })
  const activeSelf = await findActiveSelf()

  if (selfCount + guestCount > 0) assertRegistrationWindow(activity, activityDate, now, isAdmin)
  if (selfCount === 1) {
    await writeRegistrationWithRetry(supabase, { existing: activeSelf, findAfterConflict: findActiveSelf, createPayload: () => selfRegistrationPayload(activityId, activityDateId, memberId) })
  } else if (activeSelf) {
    await writeRegistration(supabase, activeSelf.id, { cancelled_at: submitTime })
  }
  if (activityDateId !== null) await writeRegistrationGuests(supabase, guestPayload(activityId, activityDateId, memberId, normalizedGuests, isAdmin))
  return { ok: true }
}

export async function updateSeasonLeave(context: RegistrationCommandContext, body: Record<string, any>): Promise<RegistrationCommandResult> {
  const { supabase, memberId, activityId, submitTime, now, isAdmin } = context
  const { activityDate, selfCount, guestCount, guests } = parseSeasonLeaveInput(body, isAdmin ? Number.MAX_SAFE_INTEGER : MEMBER_GUEST_LIMIT)
  const normalizedGuests = guests.slice(0, guestCount)
  const activity = await getActivityForRegistration(supabase, activityId)
  assertSeasonEnabled(activity)
  if (guestCount > 0) assertRegistrationWindow(activity, activityDate, now, isAdmin)
  const activityDateId = await fetchActivityDateId(supabase, activityId, activityDate)
  if (activityDateId === null) return { error: 'activity_date_not_found', status: 404 }
  const seasonRegistration = await findRegistration(supabase, { activityId, memberId, activityDateId: null })
  if (!seasonRegistration) return { error: 'season_registration_not_found', status: 404 }
  const dateStatus = await fetchSeasonRegistrationDateStatuses(supabase, [seasonRegistration.id], activityDateId)
  const isCurrentlyOnLeave = dateStatus.get(seasonRegistration.id)?.is_on_leave ?? false
  if ((selfCount === 0) !== isCurrentlyOnLeave) await setSeasonRegistrationDateStatus(supabase, seasonRegistration.id, activityDateId, selfCount === 0, submitTime)
  await writeRegistrationGuests(supabase, guestPayload(activityId, activityDateId, memberId, normalizedGuests, isAdmin))
  return { ok: true }
}

export async function directSeasonRegister(context: Omit<RegistrationCommandContext, 'isAdmin'>, body: Record<string, any>): Promise<RegistrationCommandResult> {
  const { supabase, memberId, activityId, now } = context
  const activity = await getActivityForRegistration(supabase, activityId)
  assertRegistrationWindow(activity, null, now)
  const seasonPlan = body?.seasonPlan === 'half-year' ? 'half-year' : 'quarter'
  const findActiveSelf = () => findRegistration(supabase, { activityId, memberId, activityDateId: null })
  await writeRegistrationWithRetry(supabase, {
    existing: await findActiveSelf(),
    findAfterConflict: findActiveSelf,
    createPayload: () => selfRegistrationPayload(activityId, null, memberId, seasonPlan),
  })
  return { ok: true }
}

export async function cancelSeasonRegistration(context: Omit<RegistrationCommandContext, 'isAdmin'>): Promise<RegistrationCommandResult> {
  const { supabase, memberId, activityId, submitTime } = context
  const activity = await getActivityForRegistration(supabase, activityId)
  assertSeasonEnabled(activity)
  const activeRegistration = await findRegistration(supabase, { activityId, memberId, activityDateId: null })
  if (activeRegistration) await writeRegistration(supabase, activeRegistration.id, { cancelled_at: submitTime })
  return { ok: true }
}
