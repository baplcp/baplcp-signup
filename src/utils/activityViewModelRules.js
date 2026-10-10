import { SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_QUARTER, seasonPlansOverlap } from './seasonPlan.js'

// 已報名與重疊方案優先顯示「已截止」；後季要等一季首場結束後才開放。
export function getVisibleSeasonPlans(availablePlans, registeredPlans, now, today) {
  const quarterStartDate = availablePlans.find(plan => plan.plan === SEASON_PLAN_QUARTER)?.firstDate
  const isLateQuarterOpen = !!quarterStartDate && quarterStartDate < today

  return availablePlans.map(plan => {
    const isRegistered = registeredPlans.includes(plan.plan)
    const overlapsRegistered = !isRegistered && registeredPlans.some(registeredPlan => seasonPlansOverlap(registeredPlan, plan.plan))
    const waitsForFirstHalf = plan.plan === SEASON_PLAN_LATE_QUARTER && !isLateQuarterOpen
    const notOpenYet = (plan.openAt && now < plan.openAt) || waitsForFirstHalf
    const unselectableReason =
      isRegistered || overlapsRegistered ? '已截止' : plan.closeAt && now >= plan.closeAt ? '已截止' : plan.firstDate && plan.firstDate < today ? '已開打' : notOpenYet ? '尚未開放' : ''
    return { ...plan, isRegistered, unselectableReason, selectable: !unselectableReason }
  })
}

// 季打各期間各自編號、各自計算正取與候補。
export function getSeasonTabMembers(members, tabPlan, capacity) {
  if (!tabPlan) return members
  return members.filter(member => seasonPlansOverlap(member.seasonPlan, tabPlan)).map((member, index) => ({ ...member, status: index >= (capacity ?? Infinity) ? '候補' : undefined }))
}

export function getVacancyCount(activityType, capacity, members) {
  if (activityType === 'season' && (!capacity || capacity === 'unlimited')) return '∞'
  const confirmedCount = members.filter(member => !member.status).length
  return Math.max(0, (activityType === 'season' ? Number(capacity) : (capacity ?? 0)) - confirmedCount)
}
