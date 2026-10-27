import { seasonPlanCoversDate } from '../_shared/season-plan.ts'

export type LeaveNotification = { kind: 'season' | 'pickup'; activityDateId: number; activityDate: string }

export async function fetchLeaveSessionPage(supabase: any, activityId: string | number, activityDateId: number, activityDate: string) {
  const { data, error } = await supabase.rpc('get_activity_page', { p_activity_id: activityId, p_activity_date_id: activityDateId })
  if (error) throw error
  if (!data?.activity || data.activity.selected_activity_date_id !== activityDateId || data.activity.selected_activity_date !== activityDate) throw new Error('activity_date_not_found')
  return data
}

export function hasActivePickupSelf(page: any, userId: string): boolean {
  return page.pickup_registrations.some((registration: any) => registration.user_id === userId && registration.is_self_registration && !registration.cancelled_at)
}

export function sessionVacancy(page: any): number {
  const { activity } = page
  const date = activity.selected_activity_date
  const pickupCount = page.pickup_registrations.reduce(
    (count: number, registration: any) =>
      count + (registration.is_self_registration && !registration.cancelled_at ? 1 : 0) + (registration.guests || []).filter((guest: any) => !guest.cancelled_at).length,
    0
  )
  const seasonCount = page.season_registrations.filter(
    (registration: any) =>
      !registration.cancelled_at && registration.is_self_registration && seasonPlanCoversDate(registration.season_plan, date, activity.dates) && !(registration.leave_dates || []).includes(date)
  ).length
  return Math.max(0, activity.single_capacity - pickupCount - seasonCount)
}

export async function sendLeaveNotification(
  token: string,
  groupId: string,
  displayName: string,
  kind: LeaveNotification['kind'],
  activityTitle: string,
  activityDate: string,
  vacancy: number
): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text: `【${kind === 'season' ? '季打' : '臨打'}請假提醒】\n${displayName} 已請假\n球局：${activityTitle}\n日期：${activityDate}\n目前缺 ${vacancy} 人` }],
    }),
  })
  if (!response.ok) throw new Error(`LINE push failed: ${await response.text()}`)
}
