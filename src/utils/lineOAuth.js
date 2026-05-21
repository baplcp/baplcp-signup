import { LINE_OAUTH_CLIENT_ID, LINE_OAUTH_REDIRECT_URI } from '~/config/env'

const STATE_KEY = 'line-oauth-state'
const POST_OAUTH_HASH_KEY = 'line-oauth-redirect-hash'

export function startLineOAuth() {
  const state = Math.random().toString(36).slice(2) + Date.now()
  sessionStorage.setItem(STATE_KEY, state)
  // 儲存目前的 hash route，登入後還原
  sessionStorage.setItem(POST_OAUTH_HASH_KEY, window.location.hash || '#/')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_OAUTH_CLIENT_ID,
    redirect_uri: LINE_OAUTH_REDIRECT_URI,
    state,
    scope: 'profile openid',
  })
  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params}`
}

/**
 * 檢查 URL 是否帶有 LINE OAuth callback 參數（code + state）。
 * 若是，驗證 state、清除 URL 參數、返回 code；否則返回 null。
 */
export function consumeOAuthCallback() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return null

  const savedState = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)

  if (state !== savedState) {
    console.warn('LINE OAuth state mismatch')
    return null
  }

  // 清除 URL 中的 code/state，避免重新整理時重複送出
  const cleanUrl = window.location.pathname
  window.history.replaceState(null, '', cleanUrl)

  return code
}

/**
 * 取出並清除登入前儲存的 hash route；若無則返回 '#/'。
 */
export function popPostOAuthRedirect() {
  const hash = sessionStorage.getItem(POST_OAUTH_HASH_KEY) ?? '#/'
  sessionStorage.removeItem(POST_OAUTH_HASH_KEY)
  return hash
}

export { LINE_OAUTH_REDIRECT_URI }
