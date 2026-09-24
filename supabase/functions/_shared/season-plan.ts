// 與前端 src/utils/seasonPlan.js、資料庫 season_plan_covers_date 相同的規則：
// 一季 = 第一場所在月份起算三個月；後季 = 其餘月份；半年 = 全部日期。
export const SEASON_PLAN_QUARTER = 'quarter'
export const SEASON_PLAN_LATE_QUARTER = 'late-quarter'
export const SEASON_PLAN_HALF_YEAR = 'half-year'

export type SeasonPlan = typeof SEASON_PLAN_QUARTER | typeof SEASON_PLAN_LATE_QUARTER | typeof SEASON_PLAN_HALF_YEAR

export function normalizeSeasonPlan(seasonPlan: unknown): SeasonPlan {
  return seasonPlan === SEASON_PLAN_LATE_QUARTER || seasonPlan === SEASON_PLAN_HALF_YEAR ? seasonPlan : SEASON_PLAN_QUARTER
}

function sortedActivityDates(dates: string[]): string[] {
  return [...new Set(dates.filter(Boolean))].sort()
}

// 日期字串為 YYYY-MM-DD，可直接以字串比較先後。
export function seasonQuarterCutoff(dates: string[]): string | null {
  const sorted = sortedActivityDates(dates)
  if (!sorted.length) return null

  const [year, month] = sorted[0].split('-').map(Number)
  const cutoffYear = month + 3 > 12 ? year + 1 : year
  const cutoffMonth = ((month + 2) % 12) + 1
  return `${cutoffYear}-${String(cutoffMonth).padStart(2, '0')}-01`
}

export function seasonPlanCoversDate(seasonPlan: unknown, activityDate: string | null, dates: string[]): boolean {
  if (!activityDate) return false

  const plan = normalizeSeasonPlan(seasonPlan)
  if (plan === SEASON_PLAN_HALF_YEAR) return true

  const cutoff = seasonQuarterCutoff(dates)
  if (!cutoff) return false
  return plan === SEASON_PLAN_LATE_QUARTER ? activityDate >= cutoff : activityDate < cutoff
}

export function seasonPlanDates(seasonPlan: unknown, dates: string[]): string[] {
  return sortedActivityDates(dates).filter(activityDate => seasonPlanCoversDate(seasonPlan, activityDate, dates))
}
