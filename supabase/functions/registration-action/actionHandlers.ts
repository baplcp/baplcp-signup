import { isOrganizer, normalizeId, requireOrganizer, type LineProfile } from '../_shared/function-utils.ts'
import {
  appendCancelledMembers,
  cancelSeasonRegistration,
  cancellationEntryFromGuest,
  cancellationEntryFromSelf,
  directSeasonRegister,
  saveRegistration,
  updateSeasonLeave,
  type RegistrationCommandContext,
  type RegistrationCommandResult,
} from './registrationCommands.ts'
import { findRegistrationById, syncRegistrationMember, writeRegistration } from './registrationRepository.ts'

export type AdminLineProfile = LineProfile & {
  isDevAdmin?: boolean
}

export type RegistrationActionContext = Omit<RegistrationCommandContext, 'profile' | 'isAdmin'> & {
  profile: AdminLineProfile
}

export type RegistrationActionResult = {
  body: Record<string, unknown>
  status: number
}

function toActionResult(result: RegistrationCommandResult): RegistrationActionResult {
  return 'error' in result ? { body: { error: result.error }, status: result.status } : { body: result, status: 200 }
}

async function requireAdmin(supabase: any, profile: AdminLineProfile) {
  if (profile.isDevAdmin) return
  await requireOrganizer(supabase, profile.userId)
}

async function isAdminProfile(supabase: any, profile: AdminLineProfile): Promise<boolean> {
  if (profile.isDevAdmin) return true
  return isOrganizer(supabase, profile.userId)
}

async function updateActivityAcEnabled(supabase: any, profile: AdminLineProfile, activityId: string | number, enabled: boolean) {
  const result = profile.isDevAdmin
    ? supabase.from('activities').update({ ac_enabled: enabled }).eq('id', activityId)
    : supabase.rpc('set_activity_ac_enabled_v1', { p_activity_id: activityId, p_organizer_user_id: profile.userId, p_enabled: enabled })
  const { error } = await result
  if (error) throw error
}

export async function handleRegistrationAction(context: RegistrationActionContext, action: unknown, body: Record<string, any>): Promise<RegistrationActionResult> {
  const { supabase, profile, activityId } = context

  if (action === 'save-registration') {
    const isAdmin = await isAdminProfile(supabase, profile)
    const memberId = await syncRegistrationMember(supabase, profile)
    return toActionResult(await saveRegistration({ ...context, memberId, isAdmin }, body))
  }

  if (action === 'season-leave') {
    const isAdmin = await isAdminProfile(supabase, profile)
    const memberId = await syncRegistrationMember(supabase, profile)
    return toActionResult(await updateSeasonLeave({ ...context, memberId, isAdmin }, body))
  }

  if (action === 'direct-season-register') {
    const memberId = await syncRegistrationMember(supabase, profile)
    return toActionResult(await directSeasonRegister({ ...context, memberId }, body))
  }

  if (action === 'season-cancel') {
    const memberId = await syncRegistrationMember(supabase, profile)
    return toActionResult(await cancelSeasonRegistration({ ...context, memberId }))
  }

  if (action === 'admin-toggle-payment') {
    await requireAdmin(supabase, profile)
    const registrationId = normalizeId(body?.registrationId)
    const memberType = body?.memberType
    const guestIndex = Number(body?.guestIndex)
    const field = body?.field
    if (!registrationId) return { body: { error: 'invalid_registration_id' }, status: 400 }
    if (field !== 'paid_court' && field !== 'paid_ac') return { body: { error: 'invalid_payment_field' }, status: 400 }
    if (memberType !== 'self' && memberType !== 'season_self' && memberType !== 'guest') return { body: { error: 'invalid_member_type' }, status: 400 }

    const registration = await findRegistrationById(supabase, registrationId, { guests: memberType === 'guest' })
    if (!registration) return { body: { error: 'registration_not_found' }, status: 404 }

    if (memberType === 'guest') {
      if (!Number.isInteger(guestIndex) || guestIndex < 0) return { body: { error: 'invalid_guest_index' }, status: 400 }
      const guests = Array.isArray(registration.guests) ? registration.guests : []
      if (!guests[guestIndex]) return { body: { error: 'guest_not_found' }, status: 404 }
      const nextGuests = guests.map((guest: Record<string, unknown>, index: number) => (index === guestIndex ? { ...guest, [field]: !(guest[field] ?? false) } : guest))
      await writeRegistration(supabase, registration.id, { guests: nextGuests })
    } else {
      await writeRegistration(supabase, registration.id, { [field]: !(registration[field] ?? false) })
    }

    return { body: { ok: true }, status: 200 }
  }

  if (action === 'admin-remove-member') {
    await requireAdmin(supabase, profile)
    const registrationId = normalizeId(body?.registrationId)
    const memberType = body?.memberType
    const guestIndex = Number(body?.guestIndex)
    if (!registrationId) return { body: { error: 'invalid_registration_id' }, status: 400 }
    if (memberType !== 'self' && memberType !== 'guest') return { body: { error: 'invalid_member_type' }, status: 400 }

    const registration = await findRegistrationById(supabase, registrationId, { guests: memberType === 'guest', cancelledMembers: true })
    if (!registration) return { body: { error: 'registration_not_found' }, status: 404 }

    if (memberType === 'self') {
      const removedSelf = (registration.self_count || 0) > 0 ? [cancellationEntryFromSelf(registration)] : []
      const payload = (registration.guest_count || 0) === 0 ? { status: 'cancelled' } : { self_count: 0, self_added_at: null, cancelled_members: appendCancelledMembers(registration, removedSelf) }
      await writeRegistration(supabase, registration.id, payload)
    } else {
      if (!Number.isInteger(guestIndex) || guestIndex < 0) return { body: { error: 'invalid_guest_index' }, status: 400 }
      const guests = Array.isArray(registration.guests) ? registration.guests : []
      if (!guests[guestIndex]) return { body: { error: 'guest_not_found' }, status: 404 }
      const removedGuest = cancellationEntryFromGuest(guests[guestIndex], registration)
      const nextGuests = guests.filter((_: unknown, index: number) => index !== guestIndex)
      const payload =
        (registration.self_count || 0) === 0 && nextGuests.length === 0
          ? { status: 'cancelled' }
          : { guests: nextGuests, guest_count: nextGuests.length, cancelled_members: appendCancelledMembers(registration, [removedGuest]) }
      await writeRegistration(supabase, registration.id, payload)
    }

    return { body: { ok: true }, status: 200 }
  }

  if (action === 'admin-update-ac') {
    const enabled = body?.enabled
    if (typeof enabled !== 'boolean') {
      await requireAdmin(supabase, profile)
      return { body: { error: 'invalid_enabled' }, status: 400 }
    }
    await updateActivityAcEnabled(supabase, profile, activityId, enabled)
    return { body: { ok: true }, status: 200 }
  }

  return { body: { error: 'unknown_action' }, status: 400 }
}
