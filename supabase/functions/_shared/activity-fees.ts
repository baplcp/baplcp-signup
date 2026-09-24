import { SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_QUARTER, seasonPlanDates } from './season-plan.ts'

// 後季沿用一季的單場費用，只有涵蓋的場次數不同。
export function calculateSeasonTotals(dates: string[], seasonFee: number, halfYearFee: number, acFee: number, includesAc: boolean) {
  const sortedDates = [...new Set(dates)].sort()
  const acIncludedFee = includesAc ? acFee : 0

  return {
    quarter: (seasonFee + acIncludedFee) * seasonPlanDates(SEASON_PLAN_QUARTER, sortedDates).length,
    lateQuarter: (seasonFee + acIncludedFee) * seasonPlanDates(SEASON_PLAN_LATE_QUARTER, sortedDates).length,
    halfYear: (halfYearFee + acIncludedFee) * sortedDates.length,
  }
}
