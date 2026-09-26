import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getLineProfile, isLocalDevAdminRequest, jsonResponse, normalizeId } from '../_shared/function-utils.ts'
import { handleRegistrationAction, type AdminLineProfile } from './actionHandlers.ts'
import { errorMessage } from './errorMessage.ts'

const DEV_PROFILE: AdminLineProfile = {
  userId: 'dev-user-001',
  displayName: 'Dev Admin',
  pictureUrl: null,
  isDevAdmin: true,
}

async function resolveProfile(req: Request, origin: string): Promise<AdminLineProfile> {
  const lineAccessToken = req.headers.get('x-line-access-token')
  if (lineAccessToken) return getLineProfile(lineAccessToken)

  if (isLocalDevAdminRequest(origin)) return DEV_PROFILE
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

    const profile = await resolveProfile(req, origin)
    const body = await req.json()
    const activityId = normalizeId(body?.activityId)
    if (!activityId) return jsonResponse({ error: 'invalid_activity_id' }, 400, origin)

    const result = await handleRegistrationAction(
      {
        supabase: createClient(supabaseUrl, supabaseKey),
        profile,
        activityId,
        submitTime: new Date().toISOString(),
        now: new Date(),
      },
      body?.action,
      body
    )
    return jsonResponse(result.body, result.status, origin)
  } catch (e) {
    const message = errorMessage(e)
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
