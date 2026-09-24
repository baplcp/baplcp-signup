import { fetchActivityDateId, fetchSeasonRegistrationDateStatuses } from '../_shared/normalized-collection-data.ts'
import { addTaiwanDays, getTaiwanDateAndHour, parseTaiwanDateTime } from '../_shared/taiwan-date.ts'
import { parseSeasonLeaveInput } from '../_shared/input-validation.ts'
import { normalizeSeasonPlan, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_QUARTER, seasonPlanCoversDate, seasonPlanDates, type SeasonPlan } from '../_shared/season-plan.ts'
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

// 後季有自己的一組報名開放與截止時間，其餘方案沿用季打的時間。
function assertSeasonRegistrationWindow(activity: Registration, seasonPlan: SeasonPlan, now: Date) {
  assertSeasonEnabled(activity)

  const isLateQuarter = seasonPlan === SEASON_PLAN_LATE_QUARTER
  if (isLateQuarter && !activity.season_late_enabled) throw new Error('late_quarter_disabled')

  const openDate = isLateQuarter ? activity.season_late_open_date : activity.season_open_date
  const openTime = isLateQuarter ? activity.season_late_open_time : activity.season_open_time
  const closeDate = isLateQuarter ? activity.season_late_close_date : activity.season_close_date
  const closeTime = isLateQuarter ? activity.season_late_close_time : activity.season_close_time

  if (openDate && openTime && now < parseTaiwanDateTime(openDate, openTime)) throw new Error('registration_not_open')
  if (closeDate && closeTime && now >= parseTaiwanDateTime(closeDate, closeTime)) throw new Error('registration_closed')
}

async function fetchActiveActivityDates(supabase: any, activityId: string | number): Promise<string[]> {
  const { data, error } = await supabase.from('activity_dates').select('activity_date').eq('activity_id', activityId).eq('is_active', true)
  if (error) throw error
  return (data || []).map((row: { activity_date: string }) => row.activity_date)
}

// 前端會把不能選的方案標示成不可選，這裡是同一組規則的伺服器端把關：
// 方案第一場已開打就不能再報（會付全額卻只剩幾場），而後季要等前半季開打後
// 才開放，避免有人在新一季開放報名時就只卡後半季。
async function assertSeasonPlanSelectable(supabase: any, activityId: string | number, seasonPlan: SeasonPlan, now: Date) {
  const activityDates = await fetchActiveActivityDates(supabase, activityId)
  const today = getTaiwanDateAndHour(now).date
  const planDates = seasonPlanDates(seasonPlan, activityDates)
  if (!planDates.length) throw new Error('season_plan_unavailable')
  if (planDates[0] < today) throw new Error('season_plan_started')

  if (seasonPlan === SEASON_PLAN_LATE_QUARTER) {
    const quarterDates = seasonPlanDates(SEASON_PLAN_QUARTER, activityDates)
    if (!quarterDates.length || quarterDates[0] >= today) throw new Error('registration_not_open')
  }
}

function assertRegistrationWindow(activity: Registration, activityDate: string, now: Date, isAdmin = false) {
  if (activity.pickup_open_days_before != null && activity.pickup_open_time) {
    const openDate = addTaiwanDays(activityDate, -Number(activity.pickup_open_days_before))
    if (now < parseTaiwanDateTime(openDate, activity.pickup_open_time)) throw new Error('registration_not_open')
  }
  if (!isAdmin && activity.pickup_deadline_type === 'custom' && activity.pickup_close_days_before != null && activity.pickup_close_time) {
    const closeDate = addTaiwanDays(activityDate, -Number(activity.pickup_close_days_before))
    if (now >= parseTaiwanDateTime(closeDate, activity.pickup_close_time)) throw new Error('registration_closed')
  }
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
  // 方案沒涵蓋的場次不算季打出席，請假／回歸對它沒有意義，應改走一般臨打報名。
  if (!seasonPlanCoversDate(seasonRegistration.season_plan, activityDate, await fetchActiveActivityDates(supabase, activityId))) {
    return { error: 'season_plan_not_covering_date', status: 400 }
  }
  const dateStatus = await fetchSeasonRegistrationDateStatuses(supabase, [seasonRegistration.id], activityDateId)
  const isCurrentlyOnLeave = dateStatus.get(seasonRegistration.id)?.is_on_leave ?? false
  if ((selfCount === 0) !== isCurrentlyOnLeave) await setSeasonRegistrationDateStatus(supabase, seasonRegistration.id, activityDateId, selfCount === 0, submitTime)
  await writeRegistrationGuests(supabase, guestPayload(activityId, activityDateId, memberId, normalizedGuests, isAdmin))
  return { ok: true }
}

export async function directSeasonRegister(context: Omit<RegistrationCommandContext, 'isAdmin'>, body: Record<string, any>): Promise<RegistrationCommandResult> {
  const { supabase, memberId, activityId, now } = context
  const activity = await getActivityForRegistration(supabase, activityId)
  const seasonPlan = normalizeSeasonPlan(body?.seasonPlan)
  assertSeasonRegistrationWindow(activity, seasonPlan, now)
  await assertSeasonPlanSelectable(supabase, activityId, seasonPlan, now)
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
