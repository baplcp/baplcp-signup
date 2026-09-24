import { computed } from 'vue'
import { parseTaiwanDateTime } from '~/utils/taiwanDate'
import { SEASON_PLAN_HALF_YEAR, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_QUARTER, seasonPlanDates, seasonPlanLabel, seasonPlanMonthRange } from '~/utils/seasonPlan'

function toDateTime(date, time) {
  return date && time ? parseTaiwanDateTime(date, time) : null
}

// 後季有自己的一組報名時間，一季與半年共用原本的季打報名時間。
function planWindow(activity, plan) {
  if (plan === SEASON_PLAN_LATE_QUARTER) {
    return {
      openAt: toDateTime(activity?.season_late_open_date, activity?.season_late_open_time),
      closeAt: toDateTime(activity?.season_late_close_date, activity?.season_late_close_time),
    }
  }
  return {
    openAt: toDateTime(activity?.season_open_date, activity?.season_open_time),
    closeAt: toDateTime(activity?.season_close_date, activity?.season_close_time),
  }
}

export function useSeasonPlanData(activityData) {
  return computed(() => {
    const activity = activityData.value
    const dates = [...(activity?.dates || [])].sort()
    const quarterDates = seasonPlanDates(SEASON_PLAN_QUARTER, dates)
    const lateQuarterDates = seasonPlanDates(SEASON_PLAN_LATE_QUARTER, dates)

    // 活動沒有跨過分界點時只有一季，後季與半年都不成立。
    const plans = [
      {
        plan: SEASON_PLAN_QUARTER,
        planDates: quarterDates,
        total: activity?.season_total_fee || 0,
        feePerSession: activity?.season_fee_per_session || 0,
        available: quarterDates.length > 0,
      },
      {
        plan: SEASON_PLAN_LATE_QUARTER,
        planDates: lateQuarterDates,
        total: activity?.season_late_total_fee || 0,
        feePerSession: activity?.season_fee_per_session || 0,
        available: !!activity?.season_late_enabled && lateQuarterDates.length > 0,
      },
      {
        plan: SEASON_PLAN_HALF_YEAR,
        planDates: dates,
        total: activity?.season_half_year_total_fee || 0,
        feePerSession: activity?.season_half_year_fee_per_session || 0,
        available: lateQuarterDates.length > 0,
      },
    ]

    return plans.map(plan => ({
      ...plan,
      name: seasonPlanLabel(plan.plan),
      count: plan.planDates.length,
      dateRange: seasonPlanMonthRange(plan.planDates),
      firstDate: plan.planDates[0] || null,
      ...planWindow(activity, plan.plan),
    }))
  })
}
