import { addTaiwanDays, getTaiwanWeekday, parseTaiwanDateTime } from '~/utils/taiwanDate'

// 與 Edge Function _shared/pickup-priority.ts 相同的規則：
// 臨打開放報名後的前 2 小時內報名的人，群內成員排在群外朋友前面；
// 之後才報名的人一律依報名時間排在後面，不分群內外。
const PRIORITY_WINDOW_MS = 2 * 60 * 60 * 1000
// 2 小時規則只適用這個時間點之後才開放報名的場次；更早開放（或沒有設定開放時間）的場次
// 維持舊規則：優先到開放後第一個星期二 23:59。
const SHORT_PRIORITY_OPEN_FROM = parseTaiwanDateTime('2026-10-04', '12:00')
const TUESDAY = 2
// 規則從 10 月的場次開始生效；之前的場次維持原本純照報名時間排序，舊名單顯示不變。
const GUEST_PRIORITY_START_DATE = '2026-10-01'

// 臨打開放報名後的第一個星期二 23:59。
function firstTuesdayCutoff(activityDate, pickupOpenDaysBefore) {
  if (!activityDate || activityDate < GUEST_PRIORITY_START_DATE) return null
  let cutoffDate
  if (pickupOpenDaysBefore != null && pickupOpenDaysBefore !== '') {
    const openDate = addTaiwanDays(activityDate, -Number(pickupOpenDaysBefore))
    cutoffDate = addTaiwanDays(openDate, (TUESDAY - getTaiwanWeekday(openDate) + 7) % 7)
  } else {
    cutoffDate = addTaiwanDays(activityDate, -((getTaiwanWeekday(activityDate) - TUESDAY + 7) % 7 || 7))
  }
  return parseTaiwanDateTime(addTaiwanDays(cutoffDate, 1), '00:00')
}

export function pickupGuestPriorityCutoff(activityDate, pickupOpenDaysBefore, pickupOpenTime) {
  if (!activityDate || activityDate < GUEST_PRIORITY_START_DATE) return null
  if (pickupOpenDaysBefore != null && pickupOpenDaysBefore !== '' && pickupOpenTime) {
    const openAt = parseTaiwanDateTime(addTaiwanDays(activityDate, -Number(pickupOpenDaysBefore)), pickupOpenTime)
    if (openAt >= SHORT_PRIORITY_OPEN_FROM) return new Date(openAt.getTime() + PRIORITY_WINDOW_MS)
  }
  return firstTuesdayCutoff(activityDate, pickupOpenDaysBefore)
}

// 群內成員平常最多帶 1 位群外朋友，開放後第一個星期二 23:59 之後可以再多帶 1 位。
export const MEMBER_GUEST_LIMIT = 1
export const MEMBER_GUEST_LIMIT_AFTER_SECOND_GUEST_CUTOFF = 2

export function pickupSecondGuestCutoff(activityDate, pickupOpenDaysBefore) {
  return firstTuesdayCutoff(activityDate, pickupOpenDaysBefore)
}

export function memberGuestLimit(activityDate, pickupOpenDaysBefore, now = new Date()) {
  const cutoff = pickupSecondGuestCutoff(activityDate, pickupOpenDaysBefore)
  return cutoff && now >= cutoff ? MEMBER_GUEST_LIMIT_AFTER_SECOND_GUEST_CUTOFF : MEMBER_GUEST_LIMIT
}

// entries 需帶 _ts（報名時間）與 isGuest；回傳排序後的新陣列。
export function sortPickupParticipants(entries, cutoff) {
  const cutoffTime = cutoff ? cutoff.getTime() : null
  const rank = entry => {
    const time = new Date(entry._ts).getTime()
    if (cutoffTime === null || !(time < cutoffTime)) return [2, time]
    return [entry.isGuest ? 1 : 0, time]
  }
  return entries
    .map(entry => ({ entry, key: rank(entry) }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1])
    .map(({ entry }) => entry)
}
