import { computed } from 'vue'
import { evaluateSeasonPlans } from '../../supabase/functions/_shared/season-plan-eligibility.ts'
import { SEASON_PLAN_HALF_YEAR, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_QUARTER, seasonPlanLabel, seasonPlanMonthRange } from '~/utils/seasonPlan'

const REASON_LABELS = {
  already_registered: '已報名',
  season_plan_overlap: '方案重疊',
  registration_closed: '已截止',
  season_plan_started: '已開打',
  registration_not_open: '尚未開放',
  season_plan_unavailable: '無法報名',
}

export function useSeasonPlanData(activityData, registeredPlans, nowTick) {
  return computed(() => {
    const activity = activityData.value
    return evaluateSeasonPlans(activity || {}, activity?.dates || [], registeredPlans.value, nowTick.value).map(plan => ({
      ...plan,
      name: seasonPlanLabel(plan.plan),
      count: plan.planDates.length,
      dateRange: seasonPlanMonthRange(plan.planDates),
      total:
        plan.plan === SEASON_PLAN_QUARTER ? activity?.season_total_fee || 0 : plan.plan === SEASON_PLAN_LATE_QUARTER ? activity?.season_late_total_fee || 0 : activity?.season_half_year_total_fee || 0,
      feePerSession: plan.plan === SEASON_PLAN_HALF_YEAR ? activity?.season_half_year_fee_per_session || 0 : activity?.season_fee_per_session || 0,
      isRegistered: plan.reason === 'already_registered',
      unselectableReason: REASON_LABELS[plan.reason] || '',
      selectable: plan.reason === null,
    }))
  })
}
