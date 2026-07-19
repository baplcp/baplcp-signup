const ALLOWED_ORIGINS = ['https://baplcp.github.io', 'http://localhost:5173', 'http://localhost:4173']

export type LineProfile = {
  userId: string
  displayName: string
  pictureUrl?: string | null
}

export function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, x-line-access-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export function jsonResponse(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

export function normalizeId(value: unknown): string | number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^[0-9a-z-]{1,80}$/i.test(value)) return value
  return null
}

export async function getLineProfile(accessToken: string): Promise<LineProfile> {
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

export function isLocalDevAdminRequest(origin: string) {
  return Deno.env.get('ALLOW_DEV_ADMIN') === 'true' && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))
}

export async function isOrganizer(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('members').select('role').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.role === 'organizer'
}

export async function requireOrganizer(supabase: any, userId: string) {
  if (!(await isOrganizer(supabase, userId))) throw new Error('forbidden')
}
