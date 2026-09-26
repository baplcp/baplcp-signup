import { addTaiwanDays, getTaiwanWeekday, parseTaiwanDateTime } from '~/utils/taiwanDate'

// 與 Edge Function _shared/pickup-priority.ts 相同的規則：
// 臨打開放報名後的第一個星期二 23:59 前報名的人，群內成員排在群外朋友前面；
// 之後才報名的人一律依報名時間排在後面，不分群內外。
const TUESDAY = 2
// 規則從 10 月的場次開始生效；之前的場次維持原本純照報名時間排序，舊名單顯示不變。
const GUEST_PRIORITY_START_DATE = '2026-10-01'

export function pickupGuestPriorityCutoff(activityDate, pickupOpenDaysBefore) {
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
