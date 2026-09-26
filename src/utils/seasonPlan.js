// 季打方案涵蓋哪些日期，是名單、名額與費用共用的規則，統一放在這裡。
// 一季 = 第一場所在月份起算三個月；後季 = 其餘月份；半年 = 全部日期。
export const SEASON_PLAN_QUARTER = 'quarter'
export const SEASON_PLAN_LATE_QUARTER = 'late-quarter'
export const SEASON_PLAN_HALF_YEAR = 'half-year'

const SEASON_PLAN_LABELS = {
  [SEASON_PLAN_QUARTER]: '一季',
  [SEASON_PLAN_LATE_QUARTER]: '後季',
  [SEASON_PLAN_HALF_YEAR]: '半年',
}

export function normalizeSeasonPlan(seasonPlan) {
  return seasonPlan === SEASON_PLAN_LATE_QUARTER || seasonPlan === SEASON_PLAN_HALF_YEAR ? seasonPlan : SEASON_PLAN_QUARTER
}

export function seasonPlanLabel(seasonPlan) {
  return SEASON_PLAN_LABELS[normalizeSeasonPlan(seasonPlan)]
}

function sortedActivityDates(dates) {
  return [...new Set((dates || []).filter(Boolean))].sort()
}

// 日期字串為 YYYY-MM-DD，可直接以字串比較先後。
export function seasonQuarterCutoff(dates) {
  const sorted = sortedActivityDates(dates)
  if (!sorted.length) return null

  const [year, month] = sorted[0].split('-').map(Number)
  const cutoffYear = month + 3 > 12 ? year + 1 : year
  const cutoffMonth = ((month + 2) % 12) + 1
  return `${cutoffYear}-${String(cutoffMonth).padStart(2, '0')}-01`
}

export function seasonPlanCoversDate(seasonPlan, activityDate, dates) {
  if (!activityDate) return false

  const plan = normalizeSeasonPlan(seasonPlan)
  if (plan === SEASON_PLAN_HALF_YEAR) return true

  const cutoff = seasonQuarterCutoff(dates)
  if (!cutoff) return false
  return plan === SEASON_PLAN_LATE_QUARTER ? activityDate >= cutoff : activityDate < cutoff
}

export function seasonPlanDates(seasonPlan, dates) {
  return sortedActivityDates(dates).filter(activityDate => seasonPlanCoversDate(seasonPlan, activityDate, dates))
}

// 例如 7-9月、10-12月，用於方案卡片與建立活動頁的說明文字。
export function seasonPlanMonthRange(dates) {
  const sorted = sortedActivityDates(dates)
  if (!sorted.length) return ''

  const firstMonth = Number(sorted[0].split('-')[1])
  const lastMonth = Number(sorted[sorted.length - 1].split('-')[1])
  return firstMonth === lastMonth ? `${firstMonth}月` : `${firstMonth}-${lastMonth}月`
}

// 活動日期沒有跨過分界點時只有一季可選，不顯示後季與半年。
export function hasLateQuarterDates(dates) {
  return seasonPlanDates(SEASON_PLAN_LATE_QUARTER, dates).length > 0
}

// 與資料庫 season_plans_overlap 相同：一季與後季不重疊，半年與任何方案都重疊。
export function seasonPlansOverlap(left, right) {
  const leftPlan = normalizeSeasonPlan(left)
  const rightPlan = normalizeSeasonPlan(right)
  return leftPlan === rightPlan || leftPlan === SEASON_PLAN_HALF_YEAR || rightPlan === SEASON_PLAN_HALF_YEAR
}
