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
  'season_half_year_fee_per_session',
  'pickup_fee_per_session',
  'ac_fee',
  'single_capacity',
  'season_enabled',
  'season_include_ac',
  'season_total_fee',
  'season_half_year_total_fee',
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

const GAME_TYPES = ['season']
const DEADLINE_TYPES = ['unlimited', 'custom']

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isTimeString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = value.match(/^(\d{2}):(\d{2})$/)
  if (!match) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
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

function cleanEnum(value: unknown, allowedValues: string[], fallback: string, errorName: string): string {
  const text = String(value || fallback)
  if (!allowedValues.includes(text)) throw new Error(errorName)
  return text
}

function cleanBoolean(value: unknown, fallback = false): boolean {
  if (value == null || value === '') return fallback
  if (typeof value !== 'boolean') throw new Error('invalid_boolean')
  return value
}

function cleanInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return fallback
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) throw new Error('invalid_number')
  return numberValue
}

function cleanNullableInteger(value: unknown, min: number, max: number): number | null {
  if (value == null || value === '') return null
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) throw new Error('invalid_number')
  return numberValue
}

function cleanSeasonCapacity(value: unknown): string {
  if (value == null || value === '') return 'unlimited'
  if (value === 'unlimited') return 'unlimited'
  return String(cleanInteger(value, 18, 1, 18))
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

  payload.game_type = cleanEnum(payload.game_type, GAME_TYPES, 'season', 'invalid_game_type')
  payload.title = title
  payload.location = location
  payload.dates = payload.dates
  payload.start_time = cleanNullableTime(payload.start_time)
  payload.end_time = cleanNullableTime(payload.end_time)
  payload.season_fee_per_session = cleanInteger(payload.season_fee_per_session, 0, 0, 100000)
  payload.season_half_year_fee_per_session = cleanInteger(payload.season_half_year_fee_per_session, 0, 0, 100000)
  payload.pickup_fee_per_session = cleanInteger(payload.pickup_fee_per_session, 0, 0, 100000)
  payload.ac_fee = cleanInteger(payload.ac_fee, 0, 0, 100000)
  payload.single_capacity = cleanInteger(payload.single_capacity, 18, 1, 100)
  payload.season_enabled = cleanBoolean(payload.season_enabled)
  payload.season_include_ac = cleanBoolean(payload.season_include_ac)
  payload.season_total_fee = cleanInteger(payload.season_total_fee, 0, 0, 5000000)
  payload.season_half_year_total_fee = cleanInteger(payload.season_half_year_total_fee, 0, 0, 5000000)
  payload.season_capacity = cleanSeasonCapacity(payload.season_capacity)
  payload.season_open_date = cleanNullableDate(payload.season_open_date)
  payload.season_open_time = cleanNullableTime(payload.season_open_time)
  payload.season_deadline_type = cleanEnum(payload.season_deadline_type, DEADLINE_TYPES, 'unlimited', 'invalid_deadline_type')
  payload.season_close_date = cleanNullableDate(payload.season_close_date)
  payload.season_close_time = cleanNullableTime(payload.season_close_time)
  payload.pickup_label = payload.pickup_label == null ? null : String(payload.pickup_label).trim() || null
  payload.pickup_open_days_before = cleanNullableInteger(payload.pickup_open_days_before, 1, 7)
  payload.pickup_open_time = cleanNullableTime(payload.pickup_open_time)
  payload.pickup_deadline_type = cleanEnum(payload.pickup_deadline_type, DEADLINE_TYPES, 'unlimited', 'invalid_deadline_type')
  payload.pickup_close_days_before = cleanNullableInteger(payload.pickup_close_days_before, 1, 7)
  payload.pickup_close_time = cleanNullableTime(payload.pickup_close_time)
  payload.reminder_enabled = cleanBoolean(payload.reminder_enabled)
  payload.reminder_days_before = cleanNullableInteger(payload.reminder_days_before, 1, 7)
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
