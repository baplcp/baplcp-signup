import { pickupGuestPriorityCutoff, sortPickupParticipants } from './pickup-priority.ts'
import { seasonPlanCoversDate } from './season-plan.ts'

export function sessionVacancy(page: any): number {
  const { activity } = page
  const date = activity.selected_activity_date
  const pickupCount = (page.pickup_registrations || []).reduce(
    (count: number, registration: any) =>
      count + (registration.is_self_registration && !registration.cancelled_at ? 1 : 0) + (registration.guests || []).filter((guest: any) => !guest.cancelled_at).length,
    0
  )
  const seasonCount = (page.season_registrations || []).filter(
    (registration: any) =>
      !registration.cancelled_at && registration.is_self_registration && seasonPlanCoversDate(registration.season_plan, date, activity.dates) && !(registration.leave_dates || []).includes(date)
  ).length
  return Math.max(0, activity.single_capacity - pickupCount - seasonCount)
}

export function confirmedPickupNames(page: any): string[] {
  const { activity } = page
  const date = activity.selected_activity_date
  const participants = [
    ...(page.season_registrations || [])
      .filter(
        (registration: any) =>
          !registration.cancelled_at && registration.is_self_registration && seasonPlanCoversDate(registration.season_plan, date, activity.dates) && !(registration.leave_dates || []).includes(date)
      )
      .map((registration: any) => ({
        name: registration.display_name || '未提供姓名',
        ts: registration.rejoin_times?.[date] || registration.created_at,
        isGuest: false,
        isPickup: false,
      })),
    ...(page.pickup_registrations || []).flatMap((registration: any) => [
      ...(registration.is_self_registration && !registration.cancelled_at ? [{ name: registration.display_name || '未提供姓名', ts: registration.created_at, isGuest: false, isPickup: true }] : []),
      ...(registration.guests || [])
        .filter((guest: any) => !guest.cancelled_at)
        .map((guest: any) => ({ name: guest.name || '群外', ts: guest.created_at || registration.created_at, isGuest: true, isPickup: true })),
    ]),
  ]
  const cutoff = pickupGuestPriorityCutoff(date, activity.pickup_open_days_before, activity.pickup_open_time)
  return sortPickupParticipants(participants, cutoff)
    .slice(0, activity.single_capacity)
    .filter(participant => participant.isPickup)
    .map(participant => participant.name)
}
