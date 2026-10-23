import { getTaiwanDateAndHour, parseTaiwanDateTime } from './taiwan-date.ts'
import { normalizeSeasonPlan, SEASON_PLAN_HALF_YEAR, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_QUARTER, seasonPlanDates, seasonPlansOverlap, type SeasonPlan } from './season-plan.ts'

export type SeasonPlanReason = 'already_registered' | 'season_plan_overlap' | 'registration_closed' | 'season_plan_started' | 'registration_not_open' | 'season_plan_unavailable'

type SeasonSchedule = {
  season_enabled?: boolean
  season_late_enabled?: boolean
  season_open_date?: string | null
  season_open_time?: string | null
  season_close_date?: string | null
  season_close_time?: string | null
  season_late_open_date?: string | null
  season_late_open_time?: string | null
  season_late_close_date?: string | null
  season_late_close_time?: string | null
}

type SeasonPlanEvaluation = {
  plan: SeasonPlan
  planDates: string[]
  firstDate: string | null
  available: boolean
  openAt: Date | null
  closeAt: Date | null
  reason: SeasonPlanReason | null
}

function dateTime(date?: string | null, time?: string | null): Date | null {
  return date && time ? parseTaiwanDateTime(date, time) : null
}

export function evaluateSeasonPlans(schedule: SeasonSchedule, dates: string[], registeredPlans: string[], now: Date): SeasonPlanEvaluation[] {
  const today = getTaiwanDateAndHour(now).date
  const quarterDates = seasonPlanDates(SEASON_PLAN_QUARTER, dates)
  const lateDates = seasonPlanDates(SEASON_PLAN_LATE_QUARTER, dates)
  const activePlans = registeredPlans.map(normalizeSeasonPlan)

  return [SEASON_PLAN_QUARTER, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_HALF_YEAR].map(plan => {
    const planDates = plan === SEASON_PLAN_QUARTER ? quarterDates : plan === SEASON_PLAN_LATE_QUARTER ? lateDates : seasonPlanDates(plan, dates)
    const late = plan === SEASON_PLAN_LATE_QUARTER
    const openAt = dateTime(late ? schedule.season_late_open_date : schedule.season_open_date, late ? schedule.season_late_open_time : schedule.season_open_time)
    const closeAt = dateTime(late ? schedule.season_late_close_date : schedule.season_close_date, late ? schedule.season_late_close_time : schedule.season_close_time)
    const firstDate = planDates[0] || null
    const available = schedule.season_enabled === true && planDates.length > 0 && (late ? !!schedule.season_late_enabled : plan !== SEASON_PLAN_HALF_YEAR || lateDates.length > 0)
    const registered = activePlans.includes(plan)
    const overlaps = activePlans.some(activePlan => seasonPlansOverlap(activePlan, plan))
    const waitsForQuarter = late && (!quarterDates.length || quarterDates[0] >= today)
    const reason: SeasonPlanReason | null = !available
      ? 'season_plan_unavailable'
      : registered
        ? 'already_registered'
        : overlaps
          ? 'season_plan_overlap'
          : closeAt && now >= closeAt
            ? 'registration_closed'
            : firstDate && firstDate < today
              ? 'season_plan_started'
              : (openAt && now < openAt) || waitsForQuarter
                ? 'registration_not_open'
                : null

    return { plan, planDates, firstDate, available, openAt, closeAt, reason }
  })
}
