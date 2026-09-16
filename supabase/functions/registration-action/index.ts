import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getLineProfile, isLocalDevAdminRequest, isOrganizer, jsonResponse, normalizeId, requireOrganizer, type LineProfile } from '../_shared/function-utils.ts'
import { fetchActivityDateId, fetchRegistrationCancelledMemberSnapshots, fetchRegistrationGuests, fetchSeasonRegistrationDateStatuses } from '../_shared/normalized-collection-data.ts'

type AdminLineProfile = LineProfile & {
  isDevAdmin?: boolean
}

const DEV_PROFILE: AdminLineProfile = {
  userId: 'dev-user-001',
  displayName: 'Dev Admin',
  pictureUrl: null,
  isDevAdmin: true,
}

const REGISTRATION_FIELDS = 'id, activity_id, activity_date_id, user_id, display_name, picture_url, self_count, guest_count, status, created_at, self_added_at, paid_court, paid_ac, season_plan'

type GuestInput = {
  name?: string
  gender?: string
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function parseTaiwanDateTime(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, m] = timeStr.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h - 8, m, 0))
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function normalizeGuests(value: unknown, count: number, maxCount = 6): Array<{ name: string; gender: string; added_at?: string }> {
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

async function resolveProfile(req: Request, origin: string): Promise<AdminLineProfile> {
  const lineAccessToken = req.headers.get('x-line-access-token')
  if (lineAccessToken) return getLineProfile(lineAccessToken)

  if (isLocalDevAdminRequest(origin)) {
    return DEV_PROFILE
  }

  throw new Error('missing_line_token')
}

function withPreservedGuestTimes(guests: Array<{ name: string; gender: string }>, previousGuests: Array<{ added_at?: string }> | null | undefined, submitTime: string) {
  return guests.map((guest, index) => ({
    ...guest,
    added_at: previousGuests?.[index]?.added_at || submitTime,
  }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toLegacyGuestSnapshot(guest: {
  legacy_payload: unknown
  display_name: string | null
  gender: string | null
  joined_at: string | null
  paid_court: boolean
  paid_ac: boolean
}): Record<string, unknown> {
  if (isRecord(guest.legacy_payload)) return guest.legacy_payload

  return {
    name: guest.display_name ?? '',
    gender: guest.gender ?? null,
    added_at: guest.joined_at ?? null,
    paid_court: guest.paid_court ?? false,
    paid_ac: guest.paid_ac ?? false,
  }
}

async function hydrateRegistrationCollections(
  supabase: any,
  registration: Record<string, any> | null | undefined,
  { guests = false, cancelledMembers = false }: { guests?: boolean; cancelledMembers?: boolean } = {}
) {
  if (!registration) return registration

  const [guestsByRegistrationId, cancelledMembersByRegistrationId] = await Promise.all([
    guests ? fetchRegistrationGuests(supabase, [registration.id]) : Promise.resolve(new Map()),
    cancelledMembers ? fetchRegistrationCancelledMemberSnapshots(supabase, [registration.id]) : Promise.resolve(new Map()),
  ])

  return {
    ...registration,
    ...(guests ? { guests: (guestsByRegistrationId.get(registration.id) || []).map(toLegacyGuestSnapshot) } : {}),
    ...(cancelledMembers ? { cancelled_members: cancelledMembersByRegistrationId.get(registration.id) || [] } : {}),
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505'
}

async function writeRegistration(supabase: any, registrationId: string | null, payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('write_registration_v3', {
    p_registration_id: registrationId,
    p_payload: payload,
  })
  if (error) throw error
  return data as string
}

async function setSeasonRegistrationDateStatus(supabase: any, registrationId: string, activityDateId: number, isOnLeave: boolean, changedAt: string) {
  const { error } = await supabase.rpc('set_season_registration_date_status_v3', {
    p_registration_id: registrationId,
    p_activity_date_id: activityDateId,
    p_is_on_leave: isOnLeave,
    p_changed_at: changedAt,
  })
  if (error) throw error
}

function registrationPayload(
  activityId: string | number,
  activityDateId: number | null,
  profile: LineProfile,
  selfCount: number,
  guests: Array<{ name: string; gender: string }>,
  existing: Record<string, any> | null | undefined,
  submitTime: string
) {
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

function cancellationEntryFromSelf(reg: Record<string, any>) {
  const name = reg.display_name || '未命名'
  return {
    name,
    badge: name.charAt(0),
    image: reg.picture_url ?? null,
    time: reg.self_added_at || reg.created_at || new Date().toISOString(),
  }
}

function cancellationEntryFromGuest(guest: Record<string, any>, reg: Record<string, any>) {
  const name = guest.name || '群外'
  return {
    name,
    badge: name.charAt(0),
    time: guest.added_at || reg.created_at || new Date().toISOString(),
    addedBy: reg.display_name || null,
  }
}

function appendCancelledMembers(reg: Record<string, any>, entries: Array<Record<string, any>>) {
  const existing = Array.isArray(reg.cancelled_members) ? reg.cancelled_members : []
  return [...existing, ...entries]
}

async function requireAdmin(supabase: any, profile: AdminLineProfile) {
  if (profile.isDevAdmin) return
  await requireOrganizer(supabase, profile.userId)
}

async function updateActivityAcEnabled(supabase: any, profile: AdminLineProfile, activityId: string | number, enabled: boolean) {
  const result = profile.isDevAdmin
    ? supabase.from('activities').update({ ac_enabled: enabled }).eq('id', activityId)
    : supabase.rpc('set_activity_ac_enabled_v1', { p_activity_id: activityId, p_organizer_user_id: profile.userId, p_enabled: enabled })
  const { error } = await result
  if (error) throw error
}

async function isAdminProfile(supabase: any, profile: AdminLineProfile): Promise<boolean> {
  if (profile.isDevAdmin) return true
  return isOrganizer(supabase, profile.userId)
}

async function getActivityForRegistration(supabase: any, activityId: string | number) {
  const { data, error } = await supabase
    .from('activities')
    .select(
      'id, season_enabled, season_open_date, season_open_time, season_close_date, season_close_time, pickup_open_days_before, pickup_open_time, pickup_deadline_type, pickup_close_days_before, pickup_close_time'
    )
    .eq('id', activityId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('activity_not_found')
  return data
}

function assertSeasonEnabled(activity: Record<string, any>) {
  if (!activity.season_enabled) throw new Error('season_disabled')
}

function assertRegistrationWindow(activity: Record<string, any>, activityDate: string | null, now: Date, isAdmin = false) {
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
    const openDate = addDays(activityDate, -Number(activity.pickup_open_days_before))
    if (now < parseTaiwanDateTime(openDate, activity.pickup_open_time)) {
      throw new Error('registration_not_open')
    }
  }

  if (!isAdmin && activity.pickup_deadline_type === 'custom' && activity.pickup_close_days_before != null && activity.pickup_close_time) {
    const closeDate = addDays(activityDate, -Number(activity.pickup_close_days_before))
    if (now >= parseTaiwanDateTime(closeDate, activity.pickup_close_time)) {
      throw new Error('registration_closed')
    }
  }
}

serve(async req => {
  const origin = req.headers.get('origin') ?? ''

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, origin)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) return jsonResponse({ error: 'server_misconfigured' }, 500, origin)

    const profile = await resolveProfile(req, origin)
    const body = await req.json()
    const action = body?.action
    const activityId = normalizeId(body?.activityId)
    if (!activityId) return jsonResponse({ error: 'invalid_activity_id' }, 400, origin)

    const supabase = createClient(supabaseUrl, supabaseKey)
    const submitTime = new Date().toISOString()
    const now = new Date()

    if (action === 'save-registration') {
      const activityDate = body.activityDate === null ? null : body.activityDate
      if (activityDate !== null && !isDateString(activityDate)) return jsonResponse({ error: 'invalid_activity_date' }, 400, origin)

      const selfCount = Number(body.selfCount ?? 0)
      const guestCount = Number(body.guestCount ?? 0)
      if (![0, 1].includes(selfCount)) return jsonResponse({ error: 'invalid_self_count' }, 400, origin)
      const admin = await isAdminProfile(supabase, profile)
      const normalizedGuests = normalizeGuests(body.guests, guestCount, admin ? Infinity : 6)
      const activity = await getActivityForRegistration(supabase, activityId)
      if (activityDate === null) assertSeasonEnabled(activity)

      const activityDateId = activityDate === null ? null : await fetchActivityDateId(supabase, activityId, activityDate)
      if (activityDate !== null && activityDateId === null) return jsonResponse({ error: 'activity_date_not_found' }, 404, origin)

      const existingQuery = supabase.from('registrations').select(REGISTRATION_FIELDS).eq('activity_id', activityId).eq('user_id', profile.userId).eq('status', 'active')
      const { data: existingRaw, error: existingError } =
        activityDate === null ? await existingQuery.is('activity_date_id', null).maybeSingle() : await existingQuery.eq('activity_date_id', activityDateId).maybeSingle()
      if (existingError) throw existingError
      const existing = await hydrateRegistrationCollections(supabase, existingRaw, { guests: true, cancelledMembers: true })

      if (selfCount + guestCount <= 0) {
        if (existing) {
          await writeRegistration(supabase, existing.id, { status: 'cancelled' })
        }
        return jsonResponse({ ok: true }, 200, origin)
      }

      assertRegistrationWindow(activity, activityDate, now, admin)
      const payload = registrationPayload(activityId, activityDateId, profile, selfCount, normalizedGuests, existing, submitTime)
      if (existing) {
        const removedMembers = []
        if ((existing.self_count || 0) > 0 && selfCount === 0) removedMembers.push(cancellationEntryFromSelf(existing))
        const previousGuests = Array.isArray(existing.guests) ? existing.guests : []
        previousGuests.slice(guestCount).forEach((guest: Record<string, any>) => removedMembers.push(cancellationEntryFromGuest(guest, existing)))
        if (removedMembers.length) payload.cancelled_members = appendCancelledMembers(existing, removedMembers)
      }

      if (existing) {
        await writeRegistration(supabase, existing.id, payload)
      } else {
        try {
          await writeRegistration(supabase, null, payload)
        } catch (error) {
          if (!isUniqueViolation(error)) throw error
          const retryQuery = supabase.from('registrations').select(REGISTRATION_FIELDS).eq('activity_id', activityId).eq('user_id', profile.userId).eq('status', 'active')
          const { data: retryExistingRaw, error: retryReadError } =
            activityDate === null ? await retryQuery.is('activity_date_id', null).maybeSingle() : await retryQuery.eq('activity_date_id', activityDateId).maybeSingle()
          if (retryReadError) throw retryReadError
          const retryExisting = await hydrateRegistrationCollections(supabase, retryExistingRaw, { guests: true })
          if (!retryExisting) throw error
          const retryPayload = registrationPayload(activityId, activityDateId, profile, selfCount, normalizedGuests, retryExisting, submitTime)
          await writeRegistration(supabase, retryExisting.id, retryPayload)
        }
      }
      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'season-leave') {
      const activityDate = body.activityDate
      if (!isDateString(activityDate)) return jsonResponse({ error: 'invalid_activity_date' }, 400, origin)
      const selfCount = Number(body.selfCount ?? 0)
      const guestCount = Number(body.guestCount ?? 0)
      if (![0, 1].includes(selfCount)) return jsonResponse({ error: 'invalid_self_count' }, 400, origin)
      const admin = await isAdminProfile(supabase, profile)
      const normalizedGuests = normalizeGuests(body.guests, guestCount, admin ? Infinity : 6)
      const activity = await getActivityForRegistration(supabase, activityId)
      assertSeasonEnabled(activity)
      if (guestCount > 0) {
        assertRegistrationWindow(activity, activityDate, now, admin)
      }
      const activityDateId = await fetchActivityDateId(supabase, activityId, activityDate)
      if (activityDateId === null) return jsonResponse({ error: 'activity_date_not_found' }, 404, origin)

      const { data: seasonReg, error: seasonError } = await supabase
        .from('registrations')
        .select(REGISTRATION_FIELDS)
        .eq('activity_id', activityId)
        .eq('user_id', profile.userId)
        .is('activity_date_id', null)
        .eq('status', 'active')
        .maybeSingle()
      if (seasonError) throw seasonError
      if (!seasonReg) return jsonResponse({ error: 'season_registration_not_found' }, 404, origin)

      const seasonDateStatuses = await fetchSeasonRegistrationDateStatuses(supabase, [seasonReg.id], activityDateId)
      const isCurrentlyOnLeave = seasonDateStatuses.get(seasonReg.id)?.is_on_leave ?? false
      if ((selfCount === 0) !== isCurrentlyOnLeave) {
        await setSeasonRegistrationDateStatus(supabase, seasonReg.id, activityDateId, selfCount === 0, submitTime)
      }

      const { data: pickupRegRaw, error: pickupError } = await supabase
        .from('registrations')
        .select(REGISTRATION_FIELDS)
        .eq('activity_id', activityId)
        .eq('user_id', profile.userId)
        .eq('activity_date_id', activityDateId)
        .eq('status', 'active')
        .maybeSingle()
      if (pickupError) throw pickupError
      const pickupReg = await hydrateRegistrationCollections(supabase, pickupRegRaw, { guests: true, cancelledMembers: true })

      if (guestCount > 0) {
        const payload = registrationPayload(activityId, activityDateId, profile, 0, normalizedGuests, pickupReg, submitTime)
        if (pickupReg) {
          const previousGuests = Array.isArray(pickupReg.guests) ? pickupReg.guests : []
          const removedGuests = previousGuests.slice(guestCount).map((guest: Record<string, any>) => cancellationEntryFromGuest(guest, pickupReg))
          if (removedGuests.length) payload.cancelled_members = appendCancelledMembers(pickupReg, removedGuests)
        }
        if (pickupReg) {
          await writeRegistration(supabase, pickupReg.id, payload)
        } else {
          try {
            await writeRegistration(supabase, null, payload)
          } catch (error) {
            if (!isUniqueViolation(error)) throw error
            const { data: retryPickupRegRaw, error: retryReadError } = await supabase
              .from('registrations')
              .select(REGISTRATION_FIELDS)
              .eq('activity_id', activityId)
              .eq('user_id', profile.userId)
              .eq('activity_date_id', activityDateId)
              .eq('status', 'active')
              .maybeSingle()
            if (retryReadError) throw retryReadError
            const retryPickupReg = await hydrateRegistrationCollections(supabase, retryPickupRegRaw, { guests: true })
            if (!retryPickupReg) throw error
            const retryPayload = registrationPayload(activityId, activityDateId, profile, 0, normalizedGuests, retryPickupReg, submitTime)
            await writeRegistration(supabase, retryPickupReg.id, retryPayload)
          }
        }
      } else if (pickupReg && (pickupReg.guest_count || 0) > 0) {
        await writeRegistration(supabase, pickupReg.id, { status: 'cancelled' })
      }

      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'direct-season-register') {
      const activity = await getActivityForRegistration(supabase, activityId)
      assertRegistrationWindow(activity, null, now)

      const rawPlan = body?.seasonPlan
      const seasonPlan = rawPlan === 'half-year' ? 'half-year' : 'quarter'

      const { data: activeReg, error: activeError } = await supabase
        .from('registrations')
        .select(REGISTRATION_FIELDS)
        .eq('activity_id', activityId)
        .eq('user_id', profile.userId)
        .is('activity_date_id', null)
        .eq('status', 'active')
        .maybeSingle()
      if (activeError) throw activeError
      const { data: cancelledReg, error: cancelledError } = activeReg
        ? { data: null, error: null }
        : await supabase
            .from('registrations')
            .select(REGISTRATION_FIELDS)
            .eq('activity_id', activityId)
            .eq('user_id', profile.userId)
            .is('activity_date_id', null)
            .eq('status', 'cancelled')
            .maybeSingle()
      if (cancelledError) throw cancelledError

      const existingSeasonReg = activeReg || cancelledReg
      const payload = { ...registrationPayload(activityId, null, profile, 1, [], existingSeasonReg, submitTime), season_plan: seasonPlan }
      try {
        await writeRegistration(supabase, activeReg?.id || cancelledReg?.id || null, payload)
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        const { data: retryActiveReg, error: retryReadError } = await supabase
          .from('registrations')
          .select(REGISTRATION_FIELDS)
          .eq('activity_id', activityId)
          .eq('user_id', profile.userId)
          .is('activity_date_id', null)
          .eq('status', 'active')
          .maybeSingle()
        if (retryReadError) throw retryReadError
        if (!retryActiveReg) throw error
        const retryPayload = { ...registrationPayload(activityId, null, profile, 1, [], retryActiveReg, submitTime), season_plan: seasonPlan }
        await writeRegistration(supabase, retryActiveReg.id, retryPayload)
      }
      await supabase.from('members').update({ is_season: true }).eq('user_id', profile.userId)
      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'season-cancel') {
      const activity = await getActivityForRegistration(supabase, activityId)
      assertSeasonEnabled(activity)

      const { data: activeReg, error: activeError } = await supabase
        .from('registrations')
        .select('id')
        .eq('activity_id', activityId)
        .eq('user_id', profile.userId)
        .is('activity_date_id', null)
        .eq('status', 'active')
        .maybeSingle()
      if (activeError) throw activeError
      if (activeReg) {
        await writeRegistration(supabase, activeReg.id, { status: 'cancelled' })
      }
      await supabase.from('members').update({ is_season: false }).eq('user_id', profile.userId)
      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'admin-toggle-payment') {
      await requireAdmin(supabase, profile)
      const registrationId = normalizeId(body?.registrationId)
      const memberType = body?.memberType
      const guestIndex = Number(body?.guestIndex)
      const field = body?.field
      if (!registrationId) return jsonResponse({ error: 'invalid_registration_id' }, 400, origin)
      if (field !== 'paid_court' && field !== 'paid_ac') return jsonResponse({ error: 'invalid_payment_field' }, 400, origin)
      if (memberType !== 'self' && memberType !== 'season_self' && memberType !== 'guest') return jsonResponse({ error: 'invalid_member_type' }, 400, origin)

      const { data: regRaw, error: regError } = await supabase.from('registrations').select(REGISTRATION_FIELDS).eq('id', registrationId).maybeSingle()
      if (regError) throw regError
      const reg = await hydrateRegistrationCollections(supabase, regRaw, { guests: memberType === 'guest' })
      if (!reg) return jsonResponse({ error: 'registration_not_found' }, 404, origin)

      if (memberType === 'guest') {
        if (!Number.isInteger(guestIndex) || guestIndex < 0) return jsonResponse({ error: 'invalid_guest_index' }, 400, origin)
        const guests = Array.isArray(reg.guests) ? reg.guests : []
        if (!guests[guestIndex]) return jsonResponse({ error: 'guest_not_found' }, 404, origin)
        const nextGuests = guests.map((guest: Record<string, unknown>, index: number) => (index === guestIndex ? { ...guest, [field]: !(guest[field] ?? false) } : guest))
        await writeRegistration(supabase, reg.id, { guests: nextGuests })
      } else {
        await writeRegistration(supabase, reg.id, { [field]: !(reg[field] ?? false) })
      }

      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'admin-remove-member') {
      await requireAdmin(supabase, profile)
      const registrationId = normalizeId(body?.registrationId)
      const memberType = body?.memberType
      const guestIndex = Number(body?.guestIndex)
      if (!registrationId) return jsonResponse({ error: 'invalid_registration_id' }, 400, origin)
      if (memberType !== 'self' && memberType !== 'guest') return jsonResponse({ error: 'invalid_member_type' }, 400, origin)

      const { data: regRaw, error: regError } = await supabase.from('registrations').select(REGISTRATION_FIELDS).eq('id', registrationId).maybeSingle()
      if (regError) throw regError
      const reg = await hydrateRegistrationCollections(supabase, regRaw, { guests: memberType === 'guest', cancelledMembers: true })
      if (!reg) return jsonResponse({ error: 'registration_not_found' }, 404, origin)

      if (memberType === 'self') {
        const removedSelf = (reg.self_count || 0) > 0 ? [cancellationEntryFromSelf(reg)] : []
        const updatePayload = (reg.guest_count || 0) === 0 ? { status: 'cancelled' } : { self_count: 0, self_added_at: null, cancelled_members: appendCancelledMembers(reg, removedSelf) }
        await writeRegistration(supabase, reg.id, updatePayload)
      } else {
        if (!Number.isInteger(guestIndex) || guestIndex < 0) return jsonResponse({ error: 'invalid_guest_index' }, 400, origin)
        const guests = Array.isArray(reg.guests) ? reg.guests : []
        if (!guests[guestIndex]) return jsonResponse({ error: 'guest_not_found' }, 404, origin)
        const removedGuest = cancellationEntryFromGuest(guests[guestIndex], reg)
        const nextGuests = guests.filter((_: unknown, index: number) => index !== guestIndex)
        const payload =
          (reg.self_count || 0) === 0 && nextGuests.length === 0
            ? { status: 'cancelled' }
            : { guests: nextGuests, guest_count: nextGuests.length, cancelled_members: appendCancelledMembers(reg, [removedGuest]) }
        await writeRegistration(supabase, reg.id, payload)
      }

      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'admin-update-ac') {
      const enabled = body?.enabled
      if (typeof enabled !== 'boolean') {
        await requireAdmin(supabase, profile)
        return jsonResponse({ error: 'invalid_enabled' }, 400, origin)
      }
      await updateActivityAcEnabled(supabase, profile, activityId, enabled)
      return jsonResponse({ ok: true }, 200, origin)
    }

    return jsonResponse({ error: 'unknown_action' }, 400, origin)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error'
    const status = ['missing_line_token', 'invalid_line_token', 'invalid_line_profile'].includes(message)
      ? 401
      : message === 'forbidden'
        ? 403
        : message === 'registration_not_open' || message === 'registration_closed'
          ? 403
          : message.includes('capacity_exceeded') || message.includes('duplicate key')
            ? 409
            : 400
    console.error('registration-action error', message)
    return jsonResponse({ error: message }, status, origin)
  }
})
