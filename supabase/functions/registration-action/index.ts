import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = ['https://baplcp.github.io', 'http://localhost:5173', 'http://localhost:4173']

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, x-line-access-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

type LineProfile = {
  userId: string
  displayName: string
  pictureUrl?: string | null
}

type GuestInput = {
  name?: string
  gender?: string
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

function normalizeId(value: unknown): string | number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^[0-9a-z-]{1,80}$/i.test(value)) return value
  return null
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
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

async function getLineProfile(accessToken: string): Promise<LineProfile> {
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) throw new Error('invalid_line_token')
  const profile = await profileRes.json()
  if (!profile?.userId || !profile?.displayName) throw new Error('invalid_line_profile')
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl ?? null,
  }
}

function withPreservedGuestTimes(guests: Array<{ name: string; gender: string }>, previousGuests: Array<{ added_at?: string }> | null | undefined, submitTime: string) {
  return guests.map((guest, index) => ({
    ...guest,
    added_at: previousGuests?.[index]?.added_at || submitTime,
  }))
}

async function requireOrganizer(supabase: any, userId: string) {
  const { data, error } = await supabase.from('members').select('role').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data?.role !== 'organizer') throw new Error('forbidden')
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
    const lineAccessToken = req.headers.get('x-line-access-token')
    if (!lineAccessToken) return jsonResponse({ error: 'missing_line_token' }, 401, origin)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) return jsonResponse({ error: 'server_misconfigured' }, 500, origin)

    const profile = await getLineProfile(lineAccessToken)
    const body = await req.json()
    const action = body?.action
    const activityId = normalizeId(body?.activityId)
    if (!activityId) return jsonResponse({ error: 'invalid_activity_id' }, 400, origin)

    const supabase = createClient(supabaseUrl, supabaseKey)
    const submitTime = new Date().toISOString()

    if (action === 'save-registration') {
      const activityDate = body.activityDate === null ? null : body.activityDate
      if (activityDate !== null && !isDateString(activityDate)) return jsonResponse({ error: 'invalid_activity_date' }, 400, origin)

      const selfCount = Number(body.selfCount ?? 0)
      const guestCount = Number(body.guestCount ?? 0)
      if (![0, 1].includes(selfCount)) return jsonResponse({ error: 'invalid_self_count' }, 400, origin)
      const normalizedGuests = normalizeGuests(body.guests, guestCount)

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

      const guests = withPreservedGuestTimes(normalizedGuests, existing?.guests, submitTime)
      const payload = {
        activity_id: activityId,
        activity_date: activityDate,
        user_id: profile.userId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl ?? null,
        self_count: selfCount,
        self_added_at: selfCount === 1 ? (existing?.self_count ? existing.self_added_at || submitTime : submitTime) : null,
        guest_count: guestCount,
        guests,
        status: 'active',
      }

      const { error } = existing ? await supabase.from('registrations').update(payload).eq('id', existing.id) : await supabase.from('registrations').insert(payload)
      if (error) throw error
      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'season-leave') {
      const activityDate = body.activityDate
      if (!isDateString(activityDate)) return jsonResponse({ error: 'invalid_activity_date' }, 400, origin)
      const selfCount = Number(body.selfCount ?? 0)
      const guestCount = Number(body.guestCount ?? 0)
      if (![0, 1].includes(selfCount)) return jsonResponse({ error: 'invalid_self_count' }, 400, origin)
      const normalizedGuests = normalizeGuests(body.guests, guestCount)

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
        const payload = {
          activity_id: activityId,
          activity_date: activityDate,
          user_id: profile.userId,
          display_name: profile.displayName,
          picture_url: profile.pictureUrl ?? null,
          self_count: 0,
          self_added_at: null,
          guest_count: guestCount,
          guests: withPreservedGuestTimes(normalizedGuests, pickupReg?.guests, submitTime),
          status: 'active',
        }
        const { error } = pickupReg ? await supabase.from('registrations').update(payload).eq('id', pickupReg.id) : await supabase.from('registrations').insert(payload)
        if (error) throw error
      } else if (pickupReg && (pickupReg.guest_count || 0) > 0) {
        const { error } = await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', pickupReg.id)
        if (error) throw error
      }

      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'direct-season-register') {
      const payload = {
        activity_id: activityId,
        activity_date: null,
        user_id: profile.userId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl ?? null,
        self_count: 1,
        self_added_at: submitTime,
        guest_count: 0,
        guests: [],
        status: 'active',
      }
      const { data: activeReg, error: activeError } = await supabase
        .from('registrations')
        .select('id')
        .eq('activity_id', activityId)
        .eq('user_id', profile.userId)
        .is('activity_date', null)
        .eq('status', 'active')
        .maybeSingle()
      if (activeError) throw activeError
      const { data: cancelledReg, error: cancelledError } = activeReg
        ? { data: null, error: null }
        : await supabase.from('registrations').select('id').eq('activity_id', activityId).eq('user_id', profile.userId).is('activity_date', null).eq('status', 'cancelled').maybeSingle()
      if (cancelledError) throw cancelledError

      const { error } = activeReg
        ? await supabase.from('registrations').update(payload).eq('id', activeReg.id)
        : cancelledReg
          ? await supabase.from('registrations').update(payload).eq('id', cancelledReg.id)
          : await supabase.from('registrations').insert(payload)
      if (error) throw error
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
      await requireOrganizer(supabase, profile.userId)
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
      await requireOrganizer(supabase, profile.userId)
      const registrationId = normalizeId(body?.registrationId)
      const memberType = body?.memberType
      const guestIndex = Number(body?.guestIndex)
      if (!registrationId) return jsonResponse({ error: 'invalid_registration_id' }, 400, origin)
      if (memberType !== 'self' && memberType !== 'guest') return jsonResponse({ error: 'invalid_member_type' }, 400, origin)

      const { data: reg, error: regError } = await supabase.from('registrations').select('*').eq('id', registrationId).maybeSingle()
      if (regError) throw regError
      if (!reg) return jsonResponse({ error: 'registration_not_found' }, 404, origin)

      if (memberType === 'self') {
        const { error } =
          (reg.guest_count || 0) === 0
            ? await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', reg.id)
            : await supabase.from('registrations').update({ self_count: 0, self_added_at: null }).eq('id', reg.id)
        if (error) throw error
      } else {
        if (!Number.isInteger(guestIndex) || guestIndex < 0) return jsonResponse({ error: 'invalid_guest_index' }, 400, origin)
        const guests = Array.isArray(reg.guests) ? reg.guests : []
        if (!guests[guestIndex]) return jsonResponse({ error: 'guest_not_found' }, 404, origin)
        const nextGuests = guests.filter((_: unknown, index: number) => index !== guestIndex)
        const payload = (reg.self_count || 0) === 0 && nextGuests.length === 0 ? { status: 'cancelled' } : { guests: nextGuests, guest_count: nextGuests.length }
        const { error } = await supabase.from('registrations').update(payload).eq('id', reg.id)
        if (error) throw error
      }

      return jsonResponse({ ok: true }, 200, origin)
    }

    if (action === 'admin-update-ac') {
      await requireOrganizer(supabase, profile.userId)
      const enabled = body?.enabled
      if (typeof enabled !== 'boolean') return jsonResponse({ error: 'invalid_enabled' }, 400, origin)
      const { error } = await supabase.from('activities').update({ ac_enabled: enabled }).eq('id', activityId)
      if (error) throw error
      return jsonResponse({ ok: true }, 200, origin)
    }

    return jsonResponse({ error: 'unknown_action' }, 400, origin)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error'
    const status = ['invalid_line_token', 'invalid_line_profile'].includes(message) ? 401 : message === 'forbidden' ? 403 : 400
    console.error('registration-action error', message)
    return jsonResponse({ error: message }, status, origin)
  }
})
