import { confirmedPickupNames, sessionVacancy } from '../_shared/activity-vacancy.ts'
import { seasonPlanCoversDate } from '../_shared/season-plan.ts'

type PickupOpening = {
  seasonId: number
  activityDateId: number
  activityDate: string
  title: string
  pickupLabel: string | null
}

export async function listOpenedPickupSessions(supabase: any, now: Date): Promise<PickupOpening[]> {
  const openingTime = new Date(now.getTime() - 2 * 60 * 60 * 1000)
  const { data, error } = await supabase.rpc('list_registration_open_notification_candidates', {
    p_window_start: new Date(openingTime.getTime() - 60 * 1000).toISOString(),
    p_window_end: openingTime.toISOString(),
  })
  if (error) throw error
  return (data || [])
    .filter((candidate: any) => candidate.notification_type === 'pickup' && candidate.activity_date_id && candidate.activity_date)
    .map((candidate: any) => ({
      seasonId: candidate.season_id,
      activityDateId: candidate.activity_date_id,
      activityDate: candidate.activity_date,
      title: candidate.title,
      pickupLabel: candidate.pickup_label,
    }))
}

export function buildOpenLeaveReminder(opening: PickupOpening, page: any): Record<string, unknown> {
  const activity = page?.activity
  if (!activity || activity.selected_activity_date_id !== opening.activityDateId || activity.selected_activity_date !== opening.activityDate) throw new Error('activity_date_not_found')

  const seasonLeaves = (page.season_registrations || []).filter(
    (registration: any) =>
      !registration.cancelled_at &&
      registration.is_self_registration &&
      seasonPlanCoversDate(registration.season_plan, opening.activityDate, activity.dates) &&
      (registration.leave_dates || []).includes(opening.activityDate)
  )
  const seasonNames = seasonLeaves.map((registration: any) => registration.display_name || '未提供姓名')
  const pickupLeaves = (page.pickup_registrations || []).flatMap((registration: any) => [
    ...(registration.is_self_registration && registration.cancelled_at ? [registration.display_name || '未提供姓名'] : []),
    ...(registration.guests || []).filter((guest: any) => guest.cancelled_at).map((guest: any) => guest.name || '群外'),
  ])

  const replacementNames = confirmedPickupNames(page)
  const title = opening.pickupLabel || opening.title
  return {
    type: 'text',
    text: `【臨打報名狀況】\n${title}\n日期：${opening.activityDate}\n目前請假 ${seasonNames.length + pickupLeaves.length} 人\n季打：${seasonNames.join('、') || '無'}\n臨打：${pickupLeaves.join('、') || '無'}\n已補位：${replacementNames.join('、') || '無'}\n目前缺 ${sessionVacancy(page)} 人`,
  }
}
