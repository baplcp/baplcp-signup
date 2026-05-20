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
    const lineAccessToken = req.headers.get('x-line-access-token')
    if (!lineAccessToken) return jsonResponse({ error: 'missing_line_token' }, 401, origin)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) return jsonResponse({ error: 'server_misconfigured' }, 500, origin)

    const profile = await getLineProfile(lineAccessToken)
    const body = await req.json()
    const action = body?.action
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (action === 'sync') {
      const { data, error } = await supabase.from('members').select('role, gender, is_season').eq('user_id', profile.userId).maybeSingle()
      if (error) throw error

      let role = data?.role ?? 'member'
      let gender = data?.gender ?? null
      let isSeason = data?.is_season ?? false

      if (!data) {
        const { error: insertError } = await supabase.from('members').insert({
          user_id: profile.userId,
          display_name: profile.displayName,
          role: 'member',
        })
        if (insertError) throw insertError
      } else {
        const { data: latestSeason } = await supabase.from('activities').select('id').eq('season_enabled', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (latestSeason) {
          const { data: seasonReg } = await supabase
            .from('registrations')
            .select('id')
            .eq('activity_id', latestSeason.id)
            .eq('user_id', profile.userId)
            .is('activity_date', null)
            .eq('status', 'active')
            .maybeSingle()
          const nextIsSeason = !!seasonReg
          if (nextIsSeason !== data.is_season) {
            const { error: seasonError } = await supabase.from('members').update({ is_season: nextIsSeason }).eq('user_id', profile.userId)
            if (seasonError) throw seasonError
          }
          isSeason = nextIsSeason
        }
      }

      return jsonResponse({ role, gender, isSeason }, 200, origin)
    }

    if (action === 'update-gender') {
      const value = body?.gender || null
      if (value !== null && value !== 'male' && value !== 'female') return jsonResponse({ error: 'invalid_gender' }, 400, origin)
      const { error } = await supabase.from('members').update({ gender: value }).eq('user_id', profile.userId)
      if (error) throw error
      return jsonResponse({ gender: value }, 200, origin)
    }

    return jsonResponse({ error: 'unknown_action' }, 400, origin)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error'
    const status = ['invalid_line_token', 'invalid_line_profile'].includes(message) ? 401 : 400
    console.error('member-profile error', message)
    return jsonResponse({ error: message }, status, origin)
  }
})
