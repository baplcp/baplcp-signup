import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calculateSeasonTotals } from '../_shared/activity-fees.ts'
import { corsHeaders, getLineProfile, isLocalDevAdminRequest, jsonResponse, normalizeId } from '../_shared/function-utils.ts'
import { parseActivityPayload } from '../_shared/input-validation.ts'

type OrganizerIdentity = {
  userId: string | null
  isDevAdmin: boolean
}

function cleanActivityPayload(input: unknown) {
  const payload = parseActivityPayload(input)
  const dates = [...new Set(payload.dates)].sort()
  const seasonTotals = calculateSeasonTotals(dates, payload.season_fee_per_session, payload.season_half_year_fee_per_session, payload.ac_fee, payload.season_include_ac)

  return {
    ...payload,
    dates,
    season_total_fee: seasonTotals.quarter,
    season_half_year_total_fee: seasonTotals.halfYear,
  }
}

async function resolveOrganizerIdentity(req: Request, origin: string): Promise<OrganizerIdentity> {
  const lineAccessToken = req.headers.get('x-line-access-token')
  if (lineAccessToken) {
    const profile = await getLineProfile(lineAccessToken)
    return { userId: profile.userId, isDevAdmin: false }
  }

  if (isLocalDevAdminRequest(origin)) {
    return { userId: null, isDevAdmin: true }
  }

  throw new Error('missing_line_token')
}

async function writeActivity(supabase: any, organizerIdentity: OrganizerIdentity, activityId: string | number | null, payload: Record<string, unknown>) {
  const result = organizerIdentity.isDevAdmin
    ? supabase.rpc('write_activity_v3', { p_activity_id: activityId, p_payload: payload }).single()
    : supabase.rpc('write_activity_v4', { p_activity_id: activityId, p_organizer_user_id: organizerIdentity.userId, p_payload: payload }).single()
  const { data, error } = await result
  if (error) throw error
  return data
}

async function deleteActivity(supabase: any, organizerIdentity: OrganizerIdentity, activityId: string | number) {
  const result = organizerIdentity.isDevAdmin
    ? supabase.from('activities').delete().eq('id', activityId)
    : supabase.rpc('delete_activity_v1', { p_activity_id: activityId, p_organizer_user_id: organizerIdentity.userId })
  const { error } = await result
  if (error) throw error
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

    const organizerIdentity = await resolveOrganizerIdentity(req, origin)
    const body = await req.json()
    const action = body?.action
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (action === 'create') {
      const payload = cleanActivityPayload(body?.payload)
      const data = await writeActivity(supabase, organizerIdentity, null, payload)
      return jsonResponse({ data }, 200, origin)
    }

    if (action === 'update') {
      const id = normalizeId(body?.id)
      if (!id) return jsonResponse({ error: 'invalid_activity_id' }, 400, origin)
      const payload = cleanActivityPayload(body?.payload)
      const data = await writeActivity(supabase, organizerIdentity, id, payload)
      return jsonResponse({ data }, 200, origin)
    }

    if (action === 'delete') {
      const id = normalizeId(body?.id)
      if (!id) return jsonResponse({ error: 'invalid_activity_id' }, 400, origin)
      await deleteActivity(supabase, organizerIdentity, id)
      return jsonResponse({ ok: true }, 200, origin)
    }

    return jsonResponse({ error: 'unknown_action' }, 400, origin)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error'
    const status = ['missing_line_token', 'invalid_line_token', 'invalid_line_profile'].includes(message) ? 401 : message === 'forbidden' ? 403 : 400
    console.error('activity-admin error', message)
    return jsonResponse({ error: message }, status, origin)
  }
})
