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
