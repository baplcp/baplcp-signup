const requiredEnv = (key) => {
  const value = import.meta.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

const appConfig = Object.freeze({
  supabaseUrl: requiredEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: requiredEnv('VITE_SUPABASE_ANON_KEY'),
  liffId: requiredEnv('VITE_LIFF_ID'),
  lineOAuthClientId: requiredEnv('VITE_LINE_OAUTH_CLIENT_ID'),
  lineOAuthRedirectUri: requiredEnv('VITE_LINE_OAUTH_REDIRECT_URI'),
})

export const SUPABASE_URL = appConfig.supabaseUrl
export const SUPABASE_ANON_KEY = appConfig.supabaseAnonKey
export const LIFF_ID = appConfig.liffId
export const LINE_OAUTH_CLIENT_ID = appConfig.lineOAuthClientId
export const LINE_OAUTH_REDIRECT_URI = appConfig.lineOAuthRedirectUri
