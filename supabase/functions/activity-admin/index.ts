import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getLineProfile, isLocalDevAdminRequest, jsonResponse, normalizeId, requireOrganizer } from '../_shared/function-utils.ts'

const ACTIVITY_FIELDS = [
  'game_type',
  'title',
  'location',
  'dates',
  'start_time',
  'end_time',
  'season_fee_per_session',
  'pickup_fee_per_session',
  'ac_fee',
  'single_capacity',
  'season_enabled',
  'season_include_ac',
  'season_total_fee',
  'season_capacity',
  'season_open_date',
  'season_open_time',
  'season_deadline_type',
  'season_close_date',
  'season_close_time',
  'pickup_label',
  'pickup_open_days_before',
  'pickup_open_time',
  'pickup_deadline_type',
  'pickup_close_days_before',
  'pickup_close_time',
  'reminder_enabled',
  'reminder_days_before',
  'reminder_time',
]

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isTimeString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)
}

function cleanNullableDate(value: unknown): string | null {
  if (value == null || value === '') return null
  if (!isDateString(value)) throw new Error('invalid_date')
  return value
}

function cleanNullableTime(value: unknown): string | null {
  if (value == null || value === '') return null
  if (!isTimeString(value)) throw new Error('invalid_time')
  return value
}

function cleanNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function cleanNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) throw new Error('invalid_number')
  return numberValue
}

function cleanActivityPayload(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_payload')
  const source = input as Record<string, unknown>
  const payload: Record<string, unknown> = {}

  for (const field of ACTIVITY_FIELDS) {
    if (field in source) payload[field] = source[field]
  }

  const title = String(payload.title ?? '').trim()
  const location = String(payload.location ?? '').trim()
  if (!title) throw new Error('missing_title')
  if (!location) throw new Error('missing_location')
  if (!Array.isArray(payload.dates) || payload.dates.length === 0 || !payload.dates.every(isDateString)) throw new Error('invalid_dates')

  payload.game_type = String(payload.game_type || 'season')
  payload.title = title
  payload.location = location
  payload.dates = payload.dates
  payload.start_time = cleanNullableTime(payload.start_time)
  payload.end_time = cleanNullableTime(payload.end_time)
  payload.season_fee_per_session = cleanNumber(payload.season_fee_per_session, 0)
  payload.pickup_fee_per_session = cleanNumber(payload.pickup_fee_per_session, 0)
  payload.ac_fee = cleanNumber(payload.ac_fee, 0)
  payload.single_capacity = cleanNumber(payload.single_capacity, 18)
  payload.season_enabled = Boolean(payload.season_enabled)
  payload.season_include_ac = Boolean(payload.season_include_ac)
  payload.season_total_fee = cleanNumber(payload.season_total_fee, 0)
  payload.season_capacity = payload.season_capacity == null ? null : String(payload.season_capacity)
  payload.season_open_date = cleanNullableDate(payload.season_open_date)
  payload.season_open_time = cleanNullableTime(payload.season_open_time)
  payload.season_deadline_type = String(payload.season_deadline_type || 'unlimited')
  payload.season_close_date = cleanNullableDate(payload.season_close_date)
  payload.season_close_time = cleanNullableTime(payload.season_close_time)
  payload.pickup_label = payload.pickup_label == null ? null : String(payload.pickup_label).trim() || null
  payload.pickup_open_days_before = cleanNullableNumber(payload.pickup_open_days_before)
  payload.pickup_open_time = cleanNullableTime(payload.pickup_open_time)
  payload.pickup_deadline_type = String(payload.pickup_deadline_type || 'unlimited')
  payload.pickup_close_days_before = cleanNullableNumber(payload.pickup_close_days_before)
  payload.pickup_close_time = cleanNullableTime(payload.pickup_close_time)
  payload.reminder_enabled = Boolean(payload.reminder_enabled)
  payload.reminder_days_before = cleanNullableNumber(payload.reminder_days_before)
  payload.reminder_time = cleanNullableTime(payload.reminder_time)

  return payload
}

async function resolveOrganizerIdentity(req: Request, origin: string) {
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
    if (!organizerIdentity.isDevAdmin) await requireOrganizer(supabase, organizerIdentity.userId)

    if (action === 'create') {
      const payload = cleanActivityPayload(body?.payload)
      const { data, error } = await supabase.from('activities').insert(payload).select().single()
      if (error) throw error
      return jsonResponse({ data }, 200, origin)
    }

    if (action === 'update') {
      const id = normalizeId(body?.id)
      if (!id) return jsonResponse({ error: 'invalid_activity_id' }, 400, origin)
      const payload = cleanActivityPayload(body?.payload)
      const { data, error } = await supabase.from('activities').update(payload).eq('id', id).select().single()
      if (error) throw error
      return jsonResponse({ data }, 200, origin)
    }

    if (action === 'delete') {
      const id = normalizeId(body?.id)
      if (!id) return jsonResponse({ error: 'invalid_activity_id' }, 400, origin)
      const { error } = await supabase.from('activities').delete().eq('id', id)
      if (error) throw error
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
