import { isOrganizer, normalizeId, requireOrganizer, type LineProfile } from '../_shared/function-utils.ts'
import { parseSaveRegistrationInput } from '../_shared/input-validation.ts'
import { cancelSeasonRegistration, directSeasonRegister, updateSeasonLeave, type RegistrationCommandContext, type RegistrationCommandResult } from './registrationCommands.ts'
import { findRegistrationById, saveRegistrationAction, syncRegistrationMember, updateRegistrationGuest, writeRegistration } from './registrationRepository.ts'

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
    // The RPC owns the member/role lookup and all attendance mutations so
    // regular signup requires one database round trip and one transaction.
    const input = parseSaveRegistrationInput(body, Number.MAX_SAFE_INTEGER)
    await saveRegistrationAction(supabase, {
      profile,
      activityId,
      activityDate: input.activityDate,
      selfCount: input.selfCount,
      guestCount: input.guestCount,
      guests: input.guests.slice(0, input.guestCount),
      submitTime: context.submitTime,
    })
    return { body: { ok: true }, status: 200 }
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
    const guestId = normalizeId(body?.guestId)
    const field = body?.field
    if (field !== 'paid_court' && field !== 'paid_ac') return { body: { error: 'invalid_payment_field' }, status: 400 }
    if (memberType !== 'self' && memberType !== 'season_self' && memberType !== 'guest') return { body: { error: 'invalid_member_type' }, status: 400 }

    if (memberType === 'guest') {
      if (!guestId) return { body: { error: 'invalid_guest_id' }, status: 400 }
      const { data: guest, error } = await supabase.from('registration_guests').select('id, paid_court, paid_ac').eq('id', guestId).maybeSingle()
      if (error) throw error
      if (!guest) return { body: { error: 'guest_not_found' }, status: 404 }
      await updateRegistrationGuest(supabase, guest.id, { [field]: field === 'paid_court' ? !guest.paid_court : !guest.paid_ac })
    } else {
      if (!registrationId) return { body: { error: 'invalid_registration_id' }, status: 400 }
      const registration = await findRegistrationById(supabase, registrationId)
      if (!registration) return { body: { error: 'registration_not_found' }, status: 404 }
      await writeRegistration(supabase, registration.id, { [field]: !(registration[field] ?? false) })
    }

    return { body: { ok: true }, status: 200 }
  }

  if (action === 'admin-remove-member') {
    await requireAdmin(supabase, profile)
    const registrationId = normalizeId(body?.registrationId)
    const memberType = body?.memberType
    const guestId = normalizeId(body?.guestId)
    if (memberType !== 'self' && memberType !== 'guest') return { body: { error: 'invalid_member_type' }, status: 400 }

    if (memberType === 'self') {
      if (!registrationId) return { body: { error: 'invalid_registration_id' }, status: 400 }
      const registration = await findRegistrationById(supabase, registrationId)
      if (!registration) return { body: { error: 'registration_not_found' }, status: 404 }
      await writeRegistration(supabase, registration.id, { cancelled_at: context.submitTime })
    } else {
      if (!guestId) return { body: { error: 'invalid_guest_id' }, status: 400 }
      await updateRegistrationGuest(supabase, guestId, { cancelled_at: context.submitTime })
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
