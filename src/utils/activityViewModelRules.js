import { seasonPlansOverlap } from './seasonPlan.js'

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
