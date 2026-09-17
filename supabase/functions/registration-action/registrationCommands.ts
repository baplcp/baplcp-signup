import type { LineProfile } from '../_shared/function-utils.ts'
import { fetchActivityDateId, fetchSeasonRegistrationDateStatuses } from '../_shared/normalized-collection-data.ts'
import { addTaiwanDays, parseTaiwanDateTime } from '../_shared/taiwan-date.ts'
import { findRegistration, getActivityForRegistration, setSeasonRegistrationDateStatus, writeRegistration, writeRegistrationWithRetry, type Registration } from './registrationRepository.ts'

type GuestInput = {
  name?: string
  gender?: string
}

export type RegistrationCommandContext = {
  supabase: any
  profile: LineProfile
  activityId: string | number
  submitTime: string
  now: Date
  isAdmin: boolean
}

export type RegistrationCommandResult = { ok: true } | { error: string; status: number }

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizeGuests(value: unknown, count: number, maxCount = 6): Array<{ name: string; gender: string }> {
  if (!Array.isArray(value)) throw new Error('invalid_guests')
  if (!Number.isInteger(count) || count < 0 || count > maxCount) throw new Error('invalid_guest_count')
  if (value.length < count) throw new Error('guest_count_mismatch')
  return value.slice(0, count).map((guest: GuestInput) => {
    const name = String(guest?.name ?? '')
      .trim()
      .slice(0, 40)
    const gender = String(guest?.gender ?? '')
    if (gender !== 'male' && gender !== 'female') throw new Error('invalid_guest_gender')
    return { name, gender }
  })
}

function withPreservedGuestTimes(guests: Array<{ name: string; gender: string }>, previousGuests: Array<{ added_at?: string }> | null | undefined, submitTime: string) {
  return guests.map((guest, index) => ({
    ...guest,
    added_at: previousGuests?.[index]?.added_at || submitTime,
  }))
}

function registrationPayload(
  activityId: string | number,
  activityDateId: number | null,
  profile: LineProfile,
  selfCount: number,
  guests: Array<{ name: string; gender: string }>,
  existing: Registration | null | undefined,
  submitTime: string
): Record<string, any> {
  return {
    activity_id: activityId,
    activity_date_id: activityDateId,
    user_id: profile.userId,
    display_name: profile.displayName,
    picture_url: profile.pictureUrl ?? null,
    self_count: selfCount,
    self_added_at: selfCount === 1 ? (existing?.self_count ? existing.self_added_at || submitTime : submitTime) : null,
    guest_count: guests.length,
    guests: withPreservedGuestTimes(guests, existing?.guests, submitTime),
    status: 'active',
  }
}

export function cancellationEntryFromSelf(registration: Registration) {
  const name = registration.display_name || '未命名'
  return {
    name,
    badge: name.charAt(0),
    image: registration.picture_url ?? null,
    time: registration.self_added_at || registration.created_at || new Date().toISOString(),
  }
}

export function cancellationEntryFromGuest(guest: Registration, registration: Registration) {
  const name = guest.name || '群外'
  return {
    name,
    badge: name.charAt(0),
    time: guest.added_at || registration.created_at || new Date().toISOString(),
    addedBy: registration.display_name || null,
  }
}

export function appendCancelledMembers(registration: Registration, entries: Array<Record<string, unknown>>) {
  const existing = Array.isArray(registration.cancelled_members) ? registration.cancelled_members : []
  return [...existing, ...entries]
}

function assertSeasonEnabled(activity: Registration) {
  if (!activity.season_enabled) throw new Error('season_disabled')
}

function assertRegistrationWindow(activity: Registration, activityDate: string | null, now: Date, isAdmin = false) {
  if (activityDate === null) {
    assertSeasonEnabled(activity)
    if (activity.season_open_date && activity.season_open_time && now < parseTaiwanDateTime(activity.season_open_date, activity.season_open_time)) {
      throw new Error('registration_not_open')
    }
    if (!isAdmin && activity.season_close_date && activity.season_close_time && now >= parseTaiwanDateTime(activity.season_close_date, activity.season_close_time)) {
      throw new Error('registration_closed')
    }
    return
  }

  if (activity.pickup_open_days_before != null && activity.pickup_open_time) {
    const openDate = addTaiwanDays(activityDate, -Number(activity.pickup_open_days_before))
    if (now < parseTaiwanDateTime(openDate, activity.pickup_open_time)) {
      throw new Error('registration_not_open')
    }
  }

  if (!isAdmin && activity.pickup_deadline_type === 'custom' && activity.pickup_close_days_before != null && activity.pickup_close_time) {
    const closeDate = addTaiwanDays(activityDate, -Number(activity.pickup_close_days_before))
    if (now >= parseTaiwanDateTime(closeDate, activity.pickup_close_time)) {
      throw new Error('registration_closed')
    }
  }
}

export async function saveRegistration(context: RegistrationCommandContext, body: Record<string, any>): Promise<RegistrationCommandResult> {
  const { supabase, profile, activityId, submitTime, now, isAdmin } = context
  const activityDate = body.activityDate === null ? null : body.activityDate
  if (activityDate !== null && !isDateString(activityDate)) return { error: 'invalid_activity_date', status: 400 }

  const selfCount = Number(body.selfCount ?? 0)
  const guestCount = Number(body.guestCount ?? 0)
  if (![0, 1].includes(selfCount)) return { error: 'invalid_self_count', status: 400 }
  const normalizedGuests = normalizeGuests(body.guests, guestCount, isAdmin ? Infinity : 6)
  const activity = await getActivityForRegistration(supabase, activityId)
  if (activityDate === null) assertSeasonEnabled(activity)

  const activityDateId = activityDate === null ? null : await fetchActivityDateId(supabase, activityId, activityDate)
  if (activityDate !== null && activityDateId === null) return { error: 'activity_date_not_found', status: 404 }

  const findExisting = () => findRegistration(supabase, { activityId, userId: profile.userId, activityDateId, hydration: { guests: true, cancelledMembers: true } })
  const existing = await findExisting()
  if (selfCount + guestCount <= 0) {
    if (existing) await writeRegistration(supabase, existing.id, { status: 'cancelled' })
    return { ok: true }
  }

  assertRegistrationWindow(activity, activityDate, now, isAdmin)
  await writeRegistrationWithRetry(supabase, {
    existing,
    findAfterConflict: findExisting,
    createPayload: registration => {
      const payload = registrationPayload(activityId, activityDateId, profile, selfCount, normalizedGuests, registration, submitTime)
      if (!registration) return payload

      const removedMembers = []
      if ((registration.self_count || 0) > 0 && selfCount === 0) removedMembers.push(cancellationEntryFromSelf(registration))
      const previousGuests = Array.isArray(registration.guests) ? registration.guests : []
      previousGuests.slice(guestCount).forEach((guest: Registration) => removedMembers.push(cancellationEntryFromGuest(guest, registration)))
      if (removedMembers.length) payload.cancelled_members = appendCancelledMembers(registration, removedMembers)
      return payload
    },
  })

  return { ok: true }
}

export async function updateSeasonLeave(context: RegistrationCommandContext, body: Record<string, any>): Promise<RegistrationCommandResult> {
  const { supabase, profile, activityId, submitTime, now, isAdmin } = context
  const activityDate = body.activityDate
  if (!isDateString(activityDate)) return { error: 'invalid_activity_date', status: 400 }

  const selfCount = Number(body.selfCount ?? 0)
  const guestCount = Number(body.guestCount ?? 0)
  if (![0, 1].includes(selfCount)) return { error: 'invalid_self_count', status: 400 }
  const normalizedGuests = normalizeGuests(body.guests, guestCount, isAdmin ? Infinity : 6)
  const activity = await getActivityForRegistration(supabase, activityId)
  assertSeasonEnabled(activity)
  if (guestCount > 0) assertRegistrationWindow(activity, activityDate, now, isAdmin)

  const activityDateId = await fetchActivityDateId(supabase, activityId, activityDate)
  if (activityDateId === null) return { error: 'activity_date_not_found', status: 404 }

  const seasonRegistration = await findRegistration(supabase, { activityId, userId: profile.userId, activityDateId: null })
  if (!seasonRegistration) return { error: 'season_registration_not_found', status: 404 }

  const seasonDateStatuses = await fetchSeasonRegistrationDateStatuses(supabase, [seasonRegistration.id], activityDateId)
  const isCurrentlyOnLeave = seasonDateStatuses.get(seasonRegistration.id)?.is_on_leave ?? false
  if ((selfCount === 0) !== isCurrentlyOnLeave) {
    await setSeasonRegistrationDateStatus(supabase, seasonRegistration.id, activityDateId, selfCount === 0, submitTime)
  }

  const findPickupRegistration = () => findRegistration(supabase, { activityId, userId: profile.userId, activityDateId, hydration: { guests: true, cancelledMembers: true } })
  const pickupRegistration = await findPickupRegistration()
  if (guestCount > 0) {
    await writeRegistrationWithRetry(supabase, {
      existing: pickupRegistration,
      findAfterConflict: findPickupRegistration,
      createPayload: registration => {
        const payload = registrationPayload(activityId, activityDateId, profile, 0, normalizedGuests, registration, submitTime)
        if (!registration) return payload

        const previousGuests = Array.isArray(registration.guests) ? registration.guests : []
        const removedGuests = previousGuests.slice(guestCount).map((guest: Registration) => cancellationEntryFromGuest(guest, registration))
        if (removedGuests.length) payload.cancelled_members = appendCancelledMembers(registration, removedGuests)
        return payload
      },
    })
  } else if (pickupRegistration && (pickupRegistration.guest_count || 0) > 0) {
    await writeRegistration(supabase, pickupRegistration.id, { status: 'cancelled' })
  }

  return { ok: true }
}

export async function directSeasonRegister(context: Omit<RegistrationCommandContext, 'isAdmin'>, body: Record<string, any>): Promise<RegistrationCommandResult> {
  const { supabase, profile, activityId, submitTime, now } = context
  const activity = await getActivityForRegistration(supabase, activityId)
  assertRegistrationWindow(activity, null, now)

  const seasonPlan = body?.seasonPlan === 'half-year' ? 'half-year' : 'quarter'
  const activeRegistration = await findRegistration(supabase, { activityId, userId: profile.userId, activityDateId: null })
  const cancelledRegistration = activeRegistration ? null : await findRegistration(supabase, { activityId, userId: profile.userId, activityDateId: null, status: 'cancelled' })
  const existingRegistration = activeRegistration || cancelledRegistration

  await writeRegistrationWithRetry(supabase, {
    existing: existingRegistration,
    findAfterConflict: () => findRegistration(supabase, { activityId, userId: profile.userId, activityDateId: null }),
    createPayload: registration => ({ ...registrationPayload(activityId, null, profile, 1, [], registration, submitTime), season_plan: seasonPlan }),
  })
  await supabase.from('members').update({ is_season: true }).eq('user_id', profile.userId)
  return { ok: true }
}

export async function cancelSeasonRegistration(context: Omit<RegistrationCommandContext, 'isAdmin'>): Promise<RegistrationCommandResult> {
  const { supabase, profile, activityId } = context
  const activity = await getActivityForRegistration(supabase, activityId)
  assertSeasonEnabled(activity)

  const activeRegistration = await findRegistration(supabase, { activityId, userId: profile.userId, activityDateId: null })
  if (activeRegistration) await writeRegistration(supabase, activeRegistration.id, { status: 'cancelled' })
  await supabase.from('members').update({ is_season: false }).eq('user_id', profile.userId)
  return { ok: true }
}
