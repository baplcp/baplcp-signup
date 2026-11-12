import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getTaiwanDateAndHour } from '../_shared/taiwan-date.ts'
import { isLocalDevAdminRequest, requireOrganizer } from '../_shared/function-utils.ts'

const PARTICIPATION_COUNT_START_DATE = '2026-07-03'

const ALLOWED_ORIGINS = ['https://baplcp.github.io', 'http://localhost:5173', 'http://localhost:4173']
const CORS_PRELIGHT_MAX_AGE_SECONDS = '86400'

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, x-line-access-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': CORS_PRELIGHT_MAX_AGE_SECONDS,
  }
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

async function getLineProfile(accessToken: string) {
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

serve(async req => {
  const origin = req.headers.get('origin') ?? ''

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, origin)
  }

  try {
    const body = await req.json()
    const action = body?.action
    const isDevAdmin = !req.headers.get('x-line-access-token') && isLocalDevAdminRequest(origin) && (action === 'list-members' || action === 'approve-member')
    const lineAccessToken = req.headers.get('x-line-access-token')
    if (!lineAccessToken && !isDevAdmin) return jsonResponse({ error: 'missing_line_token' }, 401, origin)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) return jsonResponse({ error: 'server_misconfigured' }, 500, origin)

    const profile = isDevAdmin ? { userId: 'dev-user-001', displayName: 'Dev Admin', pictureUrl: null } : await getLineProfile(lineAccessToken!)
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (action === 'list-members' || action === 'approve-member') {
      if (!isDevAdmin) await requireOrganizer(supabase, profile.userId)
      if (action === 'list-members') {
        const members = []
        const pageSize = 500
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase
            .from('members')
            .select('id, display_name, picture_url, gender, role, approved_at, created_at')
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + pageSize - 1)
          if (error) throw error
          members.push(...(data ?? []))
          if (!data || data.length < pageSize) break
        }
        return jsonResponse({ members }, 200, origin)
      }

      const memberId = body?.memberId
      if (typeof memberId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) {
        return jsonResponse({ error: 'invalid_approval' }, 400, origin)
      }
      const { data: target, error: targetError } = await supabase.from('members').select('id, role, gender, user_id').eq('id', memberId).maybeSingle()
      if (targetError) throw targetError
      if (!target) return jsonResponse({ error: 'member_not_found' }, 404, origin)
      if (target.role !== 'member' || target.user_id === profile.userId) return jsonResponse({ error: 'forbidden' }, 403, origin)
      if (!['male', 'female'].includes(target.gender)) return jsonResponse({ error: 'gender_required' }, 400, origin)
      const { data, error } = await supabase.from('members').update({ approved_at: new Date().toISOString() }).eq('id', memberId).is('approved_at', null).select('approved_at').maybeSingle()
      if (error) throw error
      if (!data) return jsonResponse({ error: 'already_approved' }, 409, origin)
      return jsonResponse({ approvedAt: data.approved_at }, 200, origin)
    }

    if (action === 'count-past-participations') {
      const { data, error } = await supabase.rpc('count_past_participations', {
        p_user_id: profile.userId,
        p_start_date: PARTICIPATION_COUNT_START_DATE,
        p_end_date: getTaiwanDateAndHour().date,
      })
      if (error) throw error
      return jsonResponse({ count: Number(data ?? 0) }, 200, origin)
    }

    if (action === 'sync') {
      const countPromise =
        body?.includeParticipationCount === true
          ? supabase
              .rpc('count_past_participations', {
                p_user_id: profile.userId,
                p_start_date: PARTICIPATION_COUNT_START_DATE,
                p_end_date: getTaiwanDateAndHour().date,
              })
              .then(({ data, error }) => {
                if (error) {
                  console.warn('participation count unavailable', error)
                  return null
                }
                return Number(data ?? 0)
              })
              .catch(error => {
                console.warn('participation count unavailable', error)
                return null
              })
          : Promise.resolve(null)

      const { data, error } = await supabase.from('members').select('id, role, gender, approved_at, display_name, picture_url').eq('user_id', profile.userId).maybeSingle()
      if (error) throw error

      const role = data?.role ?? 'member'
      const gender = data?.gender ?? null
      let isSeason = false

      if (data && (data.display_name !== profile.displayName || data.picture_url !== profile.pictureUrl)) {
        const { error: profileError } = await supabase.from('members').update({ display_name: profile.displayName, picture_url: profile.pictureUrl }).eq('user_id', profile.userId)
        if (profileError) throw profileError
      }

      if (data) {
        const { data: seasonRegistration, error: registrationError } = await supabase
          .from('registrations')
          .select('id')
          .eq('member_id', data.id)
          .is('activity_date_id', null)
          .is('cancelled_at', null)
          .limit(1)
          .maybeSingle()
        if (registrationError) throw registrationError
        isSeason = !!seasonRegistration
      }

      const participationCount = await countPromise
      return jsonResponse({ role, gender, approvedAt: data?.approved_at ?? null, isSeason, participationCount }, 200, origin)
    }

    if (action === 'update-gender') {
      const value = body?.gender
      if (value !== 'male' && value !== 'female') return jsonResponse({ error: 'invalid_gender' }, 400, origin)
      const { data: existing, error: lookupError } = await supabase.from('members').select('id').eq('user_id', profile.userId).maybeSingle()
      if (lookupError) throw lookupError
      if (existing) {
        const { error } = await supabase.from('members').update({ gender: value }).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('members').insert({
          user_id: profile.userId,
          display_name: profile.displayName,
          picture_url: profile.pictureUrl,
          role: 'member',
          gender: value,
        })
        if (error) {
          if (error.code !== '23505') throw error
          const { error: updateError } = await supabase.from('members').update({ gender: value }).eq('user_id', profile.userId)
          if (updateError) throw updateError
        }
      }
      return jsonResponse({ gender: value }, 200, origin)
    }

    return jsonResponse({ error: 'unknown_action' }, 400, origin)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error'
    const status = ['invalid_line_token', 'invalid_line_profile'].includes(message) ? 401 : message === 'forbidden' ? 403 : 400
    console.error('member-profile error', message)
    return jsonResponse({ error: message }, status, origin)
  }
})
