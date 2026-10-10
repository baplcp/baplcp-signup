import { SEASON_PLAN_HALF_YEAR, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_QUARTER, normalizeSeasonPlan, seasonPlanDates } from '../../supabase/functions/_shared/season-plan.ts'

// 前端沿用同一份純規則；此檔只保留顯示用的標籤與月份範圍。
export {
  SEASON_PLAN_QUARTER,
  SEASON_PLAN_LATE_QUARTER,
  SEASON_PLAN_HALF_YEAR,
  normalizeSeasonPlan,
  seasonQuarterCutoff,
  seasonPlanCoversDate,
  seasonPlanDates,
  seasonPlansOverlap,
} from '../../supabase/functions/_shared/season-plan.ts'

const SEASON_PLAN_LABELS = {
  [SEASON_PLAN_QUARTER]: '一季',
  [SEASON_PLAN_LATE_QUARTER]: '後季',
  [SEASON_PLAN_HALF_YEAR]: '半年',
}

export function seasonPlanLabel(seasonPlan) {
  return SEASON_PLAN_LABELS[normalizeSeasonPlan(seasonPlan)]
}

// 例如 7-9月、10-12月，用於方案卡片與建立活動頁的說明文字。
export function seasonPlanMonthRange(dates) {
  const sorted = seasonPlanDates(SEASON_PLAN_HALF_YEAR, dates)
  if (!sorted.length) return ''

  const firstMonth = Number(sorted[0].split('-')[1])
  const lastMonth = Number(sorted[sorted.length - 1].split('-')[1])
  return firstMonth === lastMonth ? `${firstMonth}月` : `${firstMonth}-${lastMonth}月`
}

// 活動日期沒有跨過分界點時只有一季可選，不顯示後季與半年。
export function hasLateQuarterDates(dates) {
  return seasonPlanDates(SEASON_PLAN_LATE_QUARTER, dates).length > 0
}
