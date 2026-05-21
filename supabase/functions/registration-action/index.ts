import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getLineProfile, isLocalDevAdminRequest, jsonResponse, normalizeId, requireOrganizer, type LineProfile } from '../_shared/function-utils.ts'

type AdminLineProfile = LineProfile & {
  isDevAdmin?: boolean
}

const DEV_PROFILE: AdminLineProfile = {
  userId: 'dev-user-001',
  displayName: 'Dev Admin',
  pictureUrl: null,
  isDevAdmin: true,
}

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

function normalizeGuests(value: unknown, count: number): Array<{ name: string; gender: string; added_at?: string }> {
  if (!Array.isArray(value)) throw new Error('invalid_guests')
  if (!Number.isInteger(count) || count < 0 || count > 6) throw new Error('invalid_guest_count')
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

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505'
}

function registrationPayload(
  activityId: string | number,
  activityDate: string | null,
  profile: LineProfile,
  selfCount: number,
  guests: Array<{ name: string; gender: string }>,
  existing: Record<string, any> | null | undefined,
  submitTime: string
) {
  return {
    activity_id: activityId,
    activity_date: activityDate,
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

async function getActivityForRegistration(supabase: any, activityId: string | number) {
  const { data, error } = await supabase
    .from('activities')
    .select(
      'id, season_open_date, season_open_time, season_close_date, season_close_time, pickup_open_days_before, pickup_open_time, pickup_deadline_type, pickup_close_days_before, pickup_close_time'
    )
    .eq('id', activityId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('activity_not_found')
  return data
}

function assertRegistrationWindow(activity: Record<string, any>, activityDate: string | null, now: Date) {
  if (activityDate === null) {
    if (activity.season_open_date && activity.season_open_time && now < parseTaiwanDateTime(activity.season_open_date, activity.season_open_time)) {
      throw new Error('registration_not_open')
    }
    if (activity.season_close_date && activity.season_close_time && now >= parseTaiwanDateTime(activity.season_close_date, activity.season_close_time)) {
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

  if (activity.pickup_deadline_type === 'custom' && activity.pickup_close_days_before != null && activity.pickup_close_time) {
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
      const normalizedGuests = normalizeGuests(body.guests, guestCount)
      const activity = await getActivityForRegistration(supabase, activityId)

      const existingQuery = supabase.from('registrations').select('*').eq('activity_id', activityId).eq('user_id', profile.userId).eq('status', 'active')
      const { data: existing, error: existingError } =
        activityDate === null ? await existingQuery.is('activity_date', null).maybeSingle() : await existingQuery.eq('activity_date', activityDate).maybeSingle()
      if (existingError) throw existingError

      if (selfCount + guestCount <= 0) {
        if (existing) {
          const { error } = await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', existing.id)
          if (error) throw error
        }
        return jsonResponse({ ok: true }, 200, origin)
      }

      assertRegistrationWindow(activity, activityDate, now)
      const payload = registrationPayload(activityId, activityDate, profile, selfCount, normalizedGuests, existing, submitTime)
      if (existing) {
        const removedMembers = []
        if ((existing.self_count || 0) > 0 && selfCount === 0) removedMembers.push(cancellationEntryFromSelf(existing))
        const previousGuests = Array.isArray(existing.guests) ? existing.guests : []
        previousGuests.slice(guestCount).forEach((guest: Record<string, any>) => removedMembers.push(cancellationEntryFromGuest(guest, existing)))
        if (removedMembers.length) payload.cancelled_members = appendCancelledMembers(existing, removedMembers)
      }

      if (existing) {
        const { error } = await supabase.from('registrations').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('registrations').insert(payload)
        if (error) {
          if (!isUniqueViolation(error)) throw error
          const retryQuery = supabase.from('registrations').select('*').eq('activity_id', activityId).eq('user_id', profile.userId).eq('status', 'active')
          const { data: retryExisting, error: retryReadError } =
            activityDate === null ? await retryQuery.is('activity_date', null).maybeSingle() : await retryQuery.eq('activity_date', activityDate).maybeSingle()
          if (retryReadError) throw retryReadError
          if (!retryExisting) throw error
          const retryPayload = registrationPayload(activityId, activityDate, profile, selfCount, normalizedGuests, retryExisting, submitTime)
          const { error: retryWriteError } = await supabase.from('registrations').update(retryPayload).eq('id', retryExisting.id)
          if (retryWriteError) throw retryWriteError
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
      const normalizedGuests = normalizeGuests(body.guests, guestCount)
      const activity = await getActivityForRegistration(supabase, activityId)
      assertRegistrationWindow(activity, activityDate, now)

      const { data: seasonReg, error: seasonError } = await supabase
        .from('registrations')
        .select('*')
        .eq('activity_id', activityId)
        .eq('user_id', profile.userId)
        .is('activity_date', null)
        .eq('status', 'active')
        .maybeSingle()
      if (seasonError) throw seasonError
      if (!seasonReg) return jsonResponse({ error: 'season_registration_not_found' }, 404, origin)

      const leaveDates = Array.isArray(seasonReg.leave_dates) ? seasonReg.leave_dates : []
      const isCurrentlyOnLeave = leaveDates.includes(activityDate)
      if ((selfCount === 0) !== isCurrentlyOnLeave) {
        const nextLeaveDates = selfCount === 0 ? [...leaveDates, activityDate] : leaveDates.filter((date: string) => date !== activityDate)
        const updatePayload: Record<string, unknown> = { leave_dates: nextLeaveDates }
        if (selfCount !== 0) {
          updatePayload.rejoin_times = { ...(seasonReg.rejoin_times || {}), [activityDate]: submitTime }
        }
        const { error } = await supabase.from('registrations').update(updatePayload).eq('id', seasonReg.id)
        if (error) throw error
      }

      const { data: pickupReg, error: pickupError } = await supabase
        .from('registrations')
        .select('*')
        .eq('activity_id', activityId)
        .eq('user_id', profile.userId)
        .eq('activity_date', activityDate)
        .eq('status', 'active')
        .maybeSingle()
      if (pickupError) throw pickupError

      if (guestCount > 0) {
        const payload = registrationPayload(activityId, activityDate, profile, 0, normalizedGuests, pickupReg, submitTime)
        if (pickupReg) {
          const previousGuests = Array.isArray(pickupReg.guests) ? pickupReg.guests : []
          const removedGuests = previousGuests.slice(guestCount).map((guest: Record<string, any>) => cancellationEntryFromGuest(guest, pickupReg))
          if (removedGuests.length) payload.cancelled_members = appendCancelledMembers(pickupReg, removedGuests)
        }
        if (pickupReg) {
          const { error } = await supabase.from('registrations').update(payload).eq('id', pickupReg.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('registrations').insert(payload)
          if (error) {
            if (!isUniqueViolation(error)) throw error
            const { data: retryPickupReg, error: retryReadError } = await supabase
              .from('registrations')
              .select('*')
              .eq('activity_id', activityId)
              .eq('user_id', profile.userId)
              .eq('activity_date', activityDate)
              .eq('status', 'active')
              .maybeSingle()
            if (retryReadError) throw retryReadError
            if (!retryPickupReg) throw error
            const retryPayload = registrationPayload(activityId, activityDate, profile, 0, normalizedGuests, retryPickupReg, submitTime)
            const { error: retryWriteError } = await supabase.from('registrations').update(retryPayload).eq('id', retryPickupReg.id)
            if (retryWriteError) throw retryWriteError
          }
        }
      } else if (pickupReg && (pickupReg.guest_count || 0) > 0) {
        const { error } = await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', pickupReg.id)
        if (error) throw error
      }

      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'direct-season-register') {
      const activity = await getActivityForRegistration(supabase, activityId)
      assertRegistrationWindow(activity, null, now)

      const { data: activeReg, error: activeError } = await supabase
        .from('registrations')
        .select('*')
        .eq('activity_id', activityId)
        .eq('user_id', profile.userId)
        .is('activity_date', null)
        .eq('status', 'active')
        .maybeSingle()
      if (activeError) throw activeError
      const { data: cancelledReg, error: cancelledError } = activeReg
        ? { data: null, error: null }
        : await supabase.from('registrations').select('*').eq('activity_id', activityId).eq('user_id', profile.userId).is('activity_date', null).eq('status', 'cancelled').maybeSingle()
      if (cancelledError) throw cancelledError

      const existingSeasonReg = activeReg || cancelledReg
      const payload = registrationPayload(activityId, null, profile, 1, [], existingSeasonReg, submitTime)
      const { error } = activeReg
        ? await supabase.from('registrations').update(payload).eq('id', activeReg.id)
        : cancelledReg
          ? await supabase.from('registrations').update(payload).eq('id', cancelledReg.id)
          : await supabase.from('registrations').insert(payload)
      if (error) {
        if (!isUniqueViolation(error)) throw error
        const { data: retryActiveReg, error: retryReadError } = await supabase
          .from('registrations')
          .select('*')
          .eq('activity_id', activityId)
          .eq('user_id', profile.userId)
          .is('activity_date', null)
          .eq('status', 'active')
          .maybeSingle()
        if (retryReadError) throw retryReadError
        if (!retryActiveReg) throw error
        const retryPayload = registrationPayload(activityId, null, profile, 1, [], retryActiveReg, submitTime)
        const { error: retryWriteError } = await supabase.from('registrations').update(retryPayload).eq('id', retryActiveReg.id)
        if (retryWriteError) throw retryWriteError
      }
      await supabase.from('members').update({ is_season: true }).eq('user_id', profile.userId)
      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'season-cancel') {
      const { data: activeReg, error: activeError } = await supabase
        .from('registrations')
        .select('id')
        .eq('activity_id', activityId)
        .eq('user_id', profile.userId)
        .is('activity_date', null)
        .eq('status', 'active')
        .maybeSingle()
      if (activeError) throw activeError
      if (activeReg) {
        const { error } = await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', activeReg.id)
        if (error) throw error
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

      const { data: reg, error: regError } = await supabase.from('registrations').select('*').eq('id', registrationId).maybeSingle()
      if (regError) throw regError
      if (!reg) return jsonResponse({ error: 'registration_not_found' }, 404, origin)

      if (memberType === 'guest') {
        if (!Number.isInteger(guestIndex) || guestIndex < 0) return jsonResponse({ error: 'invalid_guest_index' }, 400, origin)
        const guests = Array.isArray(reg.guests) ? reg.guests : []
        if (!guests[guestIndex]) return jsonResponse({ error: 'guest_not_found' }, 404, origin)
        const nextGuests = guests.map((guest: Record<string, unknown>, index: number) => (index === guestIndex ? { ...guest, [field]: !(guest[field] ?? false) } : guest))
        const { error } = await supabase.from('registrations').update({ guests: nextGuests }).eq('id', reg.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('registrations')
          .update({ [field]: !(reg[field] ?? false) })
          .eq('id', reg.id)
        if (error) throw error
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

      const { data: reg, error: regError } = await supabase.from('registrations').select('*').eq('id', registrationId).maybeSingle()
      if (regError) throw regError
      if (!reg) return jsonResponse({ error: 'registration_not_found' }, 404, origin)

      if (memberType === 'self') {
        const removedSelf = (reg.self_count || 0) > 0 ? [cancellationEntryFromSelf(reg)] : []
        const updatePayload = (reg.guest_count || 0) === 0 ? { status: 'cancelled' } : { self_count: 0, self_added_at: null, cancelled_members: appendCancelledMembers(reg, removedSelf) }
        const { error } = await supabase.from('registrations').update(updatePayload).eq('id', reg.id)
        if (error) throw error
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
        const { error } = await supabase.from('registrations').update(payload).eq('id', reg.id)
        if (error) throw error
      }

      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'admin-update-ac') {
      await requireAdmin(supabase, profile)
      const enabled = body?.enabled
      if (typeof enabled !== 'boolean') return jsonResponse({ error: 'invalid_enabled' }, 400, origin)
      const { error } = await supabase.from('activities').update({ ac_enabled: enabled }).eq('id', activityId)
      if (error) throw error
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
