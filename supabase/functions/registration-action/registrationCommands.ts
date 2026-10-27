import { fetchActivityDateId, fetchSeasonRegistrationDateStatuses } from '../_shared/normalized-collection-data.ts'
import { addTaiwanDays, parseTaiwanDateTime } from '../_shared/taiwan-date.ts'
import { parseSeasonLeaveInput } from '../_shared/input-validation.ts'
import { pickupSecondGuestCutoff } from '../_shared/pickup-priority.ts'
import { evaluateSeasonPlans } from '../_shared/season-plan-eligibility.ts'
import { normalizeSeasonPlan, SEASON_PLAN_HALF_YEAR, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_QUARTER, seasonPlanCoversDate } from '../_shared/season-plan.ts'
import {
  findActiveSeasonRegistrations,
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

// 群內成員每場最多帶 1 位群外朋友，開放後第一個星期二 23:59 之後可以
// 再多帶 1 位；上限調降前已經帶 2 位的人仍可送出原本的 2 位，資料庫只擋「超過上限且比
// 原本更多」的寫入。與資料庫 pickup_guest_invitation_limit 相同規則。
const MEMBER_GUEST_LIMIT = 1
const MEMBER_GUEST_LIMIT_AFTER_PRIORITY_CUTOFF = 2

function memberGuestLimit(activity: Registration, activityDate: string, now: Date): number {
  const cutoff = pickupSecondGuestCutoff(activityDate, activity.pickup_open_days_before)
  return cutoff && now >= cutoff ? MEMBER_GUEST_LIMIT_AFTER_PRIORITY_CUTOFF : MEMBER_GUEST_LIMIT
}
const LEGACY_MEMBER_GUEST_INPUT_LIMIT = 2

function selfRegistrationPayload(activityId: string | number, activityDateId: number | null, memberId: string, seasonPlan?: string) {
  return { season_id: activityId, activity_date_id: activityDateId, member_id: memberId, ...(seasonPlan ? { season_plan: seasonPlan } : {}) }
}

function guestPayload(activityId: string | number, activityDateId: number, memberId: string, guests: Array<{ id?: string; name: string; gender: string }>, invitationLimit: number | null) {
  return { p_activity_id: Number(activityId), p_activity_date_id: activityDateId, p_invited_by: memberId, p_guests: guests, p_invitation_limit: invitationLimit }
}

function assertSeasonEnabled(activity: Registration) {
  if (!activity.season_enabled) throw new Error('season_disabled')
}

async function fetchActivityDates(supabase: any, activityId: string | number): Promise<string[]> {
  const { data, error } = await supabase.from('activity_dates').select('activity_date').eq('season_id', activityId)
  if (error) throw error
  return (data || []).map((row: { activity_date: string }) => row.activity_date)
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
  const { activityDate, selfCount, guestCount, guests } = parseSeasonLeaveInput(body, isAdmin ? Number.MAX_SAFE_INTEGER : LEGACY_MEMBER_GUEST_INPUT_LIMIT)
  const normalizedGuests = guests.slice(0, guestCount)
  const activity = await getActivityForRegistration(supabase, activityId)
  assertSeasonEnabled(activity)
  if (guestCount > 0) assertRegistrationWindow(activity, activityDate, now, isAdmin)
  const activityDateId = await fetchActivityDateId(supabase, activityId, activityDate)
  if (activityDateId === null) return { error: 'activity_date_not_found', status: 404 }
  const seasonRegistrations = await findActiveSeasonRegistrations(supabase, { activityId, memberId })
  if (!seasonRegistrations.length) return { error: 'season_registration_not_found', status: 404 }
  // 一季 + 後季的人有兩筆季打報名，請假要落在涵蓋這一場的那筆；
  // 方案沒涵蓋的場次不算季打出席，請假／回歸對它沒有意義，應改走一般臨打報名。
  const activityDates = await fetchActivityDates(supabase, activityId)
  const seasonRegistration = seasonRegistrations.find(registration => seasonPlanCoversDate(registration.season_plan, activityDate, activityDates))
  if (!seasonRegistration) return { error: 'season_plan_not_covering_date', status: 400 }
  const dateStatus = await fetchSeasonRegistrationDateStatuses(supabase, [seasonRegistration.id], activityDateId)
  const isCurrentlyOnLeave = dateStatus.get(seasonRegistration.id)?.is_on_leave ?? false
  if ((selfCount === 0) !== isCurrentlyOnLeave) await setSeasonRegistrationDateStatus(supabase, seasonRegistration.id, activityDateId, selfCount === 0, submitTime)
  await writeRegistrationGuests(supabase, guestPayload(activityId, activityDateId, memberId, normalizedGuests, isAdmin ? null : memberGuestLimit(activity, activityDate, now)))
  return { ok: true }
}

export async function directSeasonRegister(context: Omit<RegistrationCommandContext, 'isAdmin'>, body: Record<string, any>): Promise<RegistrationCommandResult> {
  const { supabase, memberId, activityId, now } = context
  const activity = await getActivityForRegistration(supabase, activityId)
  const seasonPlan = normalizeSeasonPlan(body?.seasonPlan)
  const [activityDates, activeRegistrations] = await Promise.all([fetchActivityDates(supabase, activityId), findActiveSeasonRegistrations(supabase, { activityId, memberId })])
  // 畫面不再提供已報方案，但在可報名期間容許同方案重送。
  const otherPlans = activeRegistrations.map(registration => normalizeSeasonPlan(registration.season_plan)).filter(plan => plan !== seasonPlan)
  const evaluation = evaluateSeasonPlans(activity, activityDates, otherPlans, now).find(plan => plan.plan === seasonPlan)
  if (evaluation?.reason) {
    const status = evaluation.reason === 'season_plan_overlap' ? 409 : evaluation.reason === 'registration_closed' || evaluation.reason === 'registration_not_open' ? 403 : 400
    return { error: evaluation.reason, status }
  }
  const findActiveSelf = async () => (await findActiveSeasonRegistrations(supabase, { activityId, memberId })).find(registration => normalizeSeasonPlan(registration.season_plan) === seasonPlan)
  await writeRegistrationWithRetry(supabase, {
    existing: activeRegistrations.find(registration => normalizeSeasonPlan(registration.season_plan) === seasonPlan),
    findAfterConflict: findActiveSelf,
    createPayload: () => selfRegistrationPayload(activityId, null, memberId, seasonPlan),
  })
  return { ok: true }
}

const SEASON_PLANS = [SEASON_PLAN_QUARTER, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_HALF_YEAR]

// 有帶 seasonPlan 時只取消該方案；沒帶時沿用舊行為取消這個活動的全部季打報名。
export async function cancelSeasonRegistration(context: Omit<RegistrationCommandContext, 'isAdmin'>, body: Record<string, any> = {}): Promise<RegistrationCommandResult> {
  const { supabase, memberId, activityId, submitTime } = context
  const requestedPlan = body?.seasonPlan
  if (requestedPlan != null && !SEASON_PLANS.includes(requestedPlan)) return { error: 'invalid_season_plan', status: 400 }
  const activity = await getActivityForRegistration(supabase, activityId)
  assertSeasonEnabled(activity)
  const activeRegistrations = await findActiveSeasonRegistrations(supabase, { activityId, memberId })
  const targets = requestedPlan == null ? activeRegistrations : activeRegistrations.filter(registration => normalizeSeasonPlan(registration.season_plan) === requestedPlan)
  for (const registration of targets) await writeRegistration(supabase, registration.id, { cancelled_at: submitTime })
  return { ok: true }
}
