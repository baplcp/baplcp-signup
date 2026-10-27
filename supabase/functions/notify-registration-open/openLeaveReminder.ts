import { sessionVacancy } from '../_shared/activity-vacancy.ts'
import { seasonPlanCoversDate } from '../_shared/season-plan.ts'

type PickupOpening = {
  seasonId: number
  activityDateId: number
  activityDate: string
  title: string
  pickupLabel: string | null
}

export async function listOpenedPickupSessions(supabase: any, now: Date): Promise<PickupOpening[]> {
  const { data, error } = await supabase.rpc('list_registration_open_notification_candidates', {
    p_window_start: new Date(now.getTime() - 60 * 1000).toISOString(),
    p_window_end: now.toISOString(),
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
  const title = opening.pickupLabel || opening.title
  return {
    type: 'text',
    text: `【臨打報名已開放】\n${title}\n日期：${opening.activityDate}\n目前請假 ${seasonNames.length} 人\n季打：${seasonNames.join('、') || '無'}\n目前缺 ${sessionVacancy(page)} 人`,
  }
}
