function requiredEnv(name) {
  const value = import.meta.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const SUPABASE_URL = requiredEnv('VITE_SUPABASE_URL')
export const SUPABASE_ANON_KEY = requiredEnv('VITE_SUPABASE_ANON_KEY')
export const LIFF_ID = requiredEnv('VITE_LIFF_ID')
export const LINE_OAUTH_CLIENT_ID = requiredEnv('VITE_LINE_OAUTH_CLIENT_ID')
export const LINE_OAUTH_REDIRECT_URI = requiredEnv('VITE_LINE_OAUTH_REDIRECT_URI')
