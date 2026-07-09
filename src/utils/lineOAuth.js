import { LINE_OAUTH_CLIENT_ID, LINE_OAUTH_REDIRECT_URI } from '~/config/env'

const STATE_KEY = 'line-oauth-state'
const POST_OAUTH_HASH_KEY = 'line-oauth-redirect-hash'
const TRANSACTION_KEY = 'line-oauth-transaction'
const TRANSACTION_TTL_MS = 10 * 60 * 1000

function safeGetStorageValue(storage, key) {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSetStorageValue(storage, key, value) {
  try {
    storage.setItem(key, value)
  } catch {
    // Ignore unavailable storage and fall back to the other storage backend.
  }
}

function safeRemoveStorageValue(storage, key) {
  try {
    storage.removeItem(key)
  } catch {
    // Ignore unavailable storage.
  }
}

function saveOAuthTransaction(state, redirectHash) {
  safeSetStorageValue(sessionStorage, STATE_KEY, state)
  safeSetStorageValue(sessionStorage, POST_OAUTH_HASH_KEY, redirectHash)
  safeSetStorageValue(
    localStorage,
    TRANSACTION_KEY,
    JSON.stringify({
      state,
      redirectHash,
      expiresAt: Date.now() + TRANSACTION_TTL_MS,
    })
  )
}

function readOAuthTransaction() {
  const state = safeGetStorageValue(sessionStorage, STATE_KEY)
  const redirectHash = safeGetStorageValue(sessionStorage, POST_OAUTH_HASH_KEY)
  if (state) return { state, redirectHash }

  try {
    const transaction = JSON.parse(safeGetStorageValue(localStorage, TRANSACTION_KEY) || 'null')
    if (transaction?.expiresAt > Date.now() && typeof transaction.state === 'string') {
      return {
        state: transaction.state,
        redirectHash: transaction.redirectHash,
      }
    }
  } catch {
    // Invalid stored OAuth transaction is treated as missing.
  }

  return null
}

function clearOAuthTransaction() {
  safeRemoveStorageValue(sessionStorage, STATE_KEY)
  safeRemoveStorageValue(localStorage, TRANSACTION_KEY)
}

export function startLineOAuth() {
  const state = Math.random().toString(36).slice(2) + Date.now()
  saveOAuthTransaction(state, window.location.hash || '#/')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_OAUTH_CLIENT_ID,
    redirect_uri: LINE_OAUTH_REDIRECT_URI,
    state,
    scope: 'profile openid',
  })
  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params}`
}

export function hasLineOAuthCallback() {
  const params = new URLSearchParams(window.location.search)
  return params.has('code') && params.has('state')
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

  const transaction = readOAuthTransaction()
  safeRemoveStorageValue(sessionStorage, STATE_KEY)

  if (state !== transaction?.state) {
    console.warn('LINE OAuth state mismatch')
    clearOAuthTransaction()
    safeRemoveStorageValue(sessionStorage, POST_OAUTH_HASH_KEY)
    window.history.replaceState(null, '', window.location.pathname)
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
  const transaction = readOAuthTransaction()
  const hash = safeGetStorageValue(sessionStorage, POST_OAUTH_HASH_KEY) ?? transaction?.redirectHash ?? '#/'
  safeRemoveStorageValue(sessionStorage, POST_OAUTH_HASH_KEY)
  safeRemoveStorageValue(localStorage, TRANSACTION_KEY)
  return hash
}

export { LINE_OAUTH_REDIRECT_URI }
