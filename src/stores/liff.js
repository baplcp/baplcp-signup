import liff from '@line/liff'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { LIFF_ID } from '~/config/env'
import { syncMemberProfile, updateMemberGender } from '~/services/memberProfileService'
import { supabase } from '~/utils/supabase'
import { consumeOAuthCallback, hasLineOAuthCallback, popPostOAuthRedirect, LINE_OAUTH_REDIRECT_URI } from '~/utils/lineOAuth'

let initializationPromise = null
let memberProfilePromise = null
const EXTERNAL_OAUTH_SESSION_KEY = 'line-oauth-session'
const EXTERNAL_OAUTH_SESSION_SKEW_MS = 60 * 1000

export const useLiffStore = defineStore('liff', () => {
  const initialized = ref(false)
  const userId = ref(null)
  const displayName = ref(null)
  const pictureUrl = ref(null)
  const lineAccessToken = ref(null)
  const role = ref('member')
  const gender = ref(null)
  const isSeason = ref(false)
  const participationCount = ref(null)
  const memberProfileInitialized = ref(false)
  const pendingRedirect = ref(null)

  function getUserProfile() {
    return {
      userId: userId.value,
      displayName: displayName.value,
      pictureUrl: pictureUrl.value,
    }
  }

  function readExternalOAuthSession() {
    try {
      const rawSession = sessionStorage.getItem(EXTERNAL_OAUTH_SESSION_KEY)
      if (!rawSession) return null

      const session = JSON.parse(rawSession)
      const isValidSession =
        session &&
        typeof session.userId === 'string' &&
        typeof session.displayName === 'string' &&
        typeof session.accessToken === 'string' &&
        typeof session.expiresAt === 'number' &&
        session.expiresAt > Date.now() + EXTERNAL_OAUTH_SESSION_SKEW_MS

      if (isValidSession) return session
    } catch (e) {
      console.warn('LINE OAuth session parse failed', e)
    }

    sessionStorage.removeItem(EXTERNAL_OAUTH_SESSION_KEY)
    return null
  }

  function saveExternalOAuthSession(data) {
    if (!data?.userId || !data?.displayName || !data?.accessToken) return

    const expiresInSeconds = Number(data.expiresIn)
    const expiresInMs = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds * 1000 : 30 * 60 * 1000

    sessionStorage.setItem(
      EXTERNAL_OAUTH_SESSION_KEY,
      JSON.stringify({
        userId: data.userId,
        displayName: data.displayName,
        pictureUrl: data.pictureUrl ?? null,
        accessToken: data.accessToken,
        expiresAt: Date.now() + expiresInMs,
      })
    )
  }

  function applyExternalOAuthSession(session) {
    userId.value = session.userId
    displayName.value = session.displayName
    pictureUrl.value = session.pictureUrl ?? null
    lineAccessToken.value = session.accessToken
    startMemberProfileSync(session.userId, session.displayName)
    initialized.value = true
  }

  // 登入時透過 Edge Function 同步 members；production 不信任前端傳入的 LINE 身分。
  function isHomeEntry() {
    const liffState = new URLSearchParams(window.location.search).get('liff.state')
    const route = (liffState ?? window.location.hash).replace(/^#/, '')
    return !route.startsWith('/') || route === '/' || route.startsWith('/?')
  }

  async function syncMember(uid, name) {
    try {
      const profile = await syncMemberProfile({
        userId: uid,
        displayName: name,
        lineAccessToken: lineAccessToken.value,
        includeParticipationCount: isHomeEntry(),
      })
      if (!profile) return
      role.value = profile.role
      gender.value = profile.gender
      isSeason.value = profile.isSeason
      participationCount.value = profile.participationCount
    } catch (e) {
      console.warn('syncMember exception', e)
    }
  }

  function startMemberProfileSync(uid, name) {
    memberProfileInitialized.value = false
    participationCount.value = null
    memberProfilePromise = syncMember(uid, name).finally(() => {
      memberProfileInitialized.value = true
    })
    return memberProfilePromise
  }

  async function ensureMemberProfile() {
    await initialize()
    await memberProfilePromise
  }

  async function getLiffProfile() {
    // liff.init() 取得的 ID token 已含有主 profile，避免額外呼叫 Profile API。
    // 這些資料只用於前端顯示；後端仍以 access token 向 LINE 驗證身分。
    try {
      const idToken = liff.getDecodedIDToken()
      if (idToken?.sub && idToken.name) {
        return {
          userId: idToken.sub,
          displayName: idToken.name,
          pictureUrl: idToken.picture ?? null,
        }
      }
    } catch (error) {
      console.warn('LIFF ID token profile unavailable', error)
    }

    // 尚未開啟 openid scope 或 SDK 沒有 ID token 時，維持既有登入行為。
    return liff.getProfile()
  }

  function applyLiffProfile(profile) {
    userId.value = profile.userId
    displayName.value = profile.displayName
    pictureUrl.value = profile.pictureUrl
    lineAccessToken.value = liff.getAccessToken()
    startMemberProfileSync(profile.userId, profile.displayName)
  }

  async function initializeClient() {
    if (import.meta.env.DEV) {
      userId.value = 'dev-user-001'
      displayName.value = 'Dev User'
      pictureUrl.value = null
      startMemberProfileSync('dev-user-001', 'Dev User')
      initialized.value = true
      return
    }

    // 保留舊版自訂 OAuth 的 callback 相容性；但 LIFF SDK 自己的登入 callback
    // 也會帶 code/state，且包含 liffClientId/liffRedirectUri，必須交回 liff.init() 處理。
    const callbackParams = new URLSearchParams(window.location.search)
    const isLiffLoginCallback = callbackParams.has('liffClientId') || callbackParams.has('liffRedirectUri')
    const hasOAuthCallback = !isLiffLoginCallback && hasLineOAuthCallback()
    const oauthCode = hasOAuthCallback ? consumeOAuthCallback() : null

    function clearLiffLoginCallback() {
      if (!isLiffLoginCallback) return

      const url = new URL(window.location.href)
      for (const key of ['code', 'state', 'liffClientId', 'liffRedirectUri']) {
        url.searchParams.delete(key)
      }
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
    if (oauthCode) {
      try {
        const { data, error } = await supabase.functions.invoke('line-token', {
          body: { code: oauthCode, redirectUri: LINE_OAUTH_REDIRECT_URI },
        })
        if (!error && data?.userId && data?.displayName && data?.accessToken) {
          saveExternalOAuthSession(data)
          applyExternalOAuthSession({
            userId: data.userId,
            displayName: data.displayName,
            pictureUrl: data.pictureUrl ?? null,
            accessToken: data.accessToken,
          })
          // 還原登入前的頁面，交由 App.vue 透過 router.replace 處理
          const targetHash = popPostOAuthRedirect()
          if (targetHash && targetHash !== '#/') {
            pendingRedirect.value = targetHash.startsWith('#') ? targetHash.slice(1) : targetHash
          }
          return
        }
      } catch (e) {
        console.warn('LINE OAuth token exchange failed', e)
      }
      // token exchange 失敗，降級為訪客狀態
      initialized.value = true
      return
    }
    if (hasOAuthCallback) {
      initialized.value = true
      return
    }

    try {
      await liff.init({
        liffId: LIFF_ID,
        // LINE 內建瀏覽器與一般外部瀏覽器都會被 LIFF 視為 external。
        // 交由 SDK 啟動登入，才能沿用 LINE App 的既有登入狀態。
        withLoginOnExternalBrowser: true,
      })
      clearLiffLoginCallback()

      if (!liff.isInClient()) {
        // 非 LIFF Browser（包括 LINE 內建瀏覽器與一般外部瀏覽器）
        const savedOAuthSession = readExternalOAuthSession()
        if (savedOAuthSession) {
          await applyExternalOAuthSession(savedOAuthSession)
          return
        }

        if (liff.isLoggedIn()) {
          // 已透過 LIFF token 登入
          const profile = await getLiffProfile()
          applyLiffProfile(profile)
        }

        // withLoginOnExternalBrowser 會在尚未登入時啟動 liff.login()。
        // 不要改用自訂 OAuth，也不要以 sessionStorage 阻擋下一次登入嘗試。
        initialized.value = true
        return
      }

      // LIFF Browser — 正常 LIFF 流程
      if (liff.isLoggedIn()) {
        const profile = await getLiffProfile()
        applyLiffProfile(profile)

        initialized.value = true
      } else {
        // LIFF Browser 會在 liff.init() 時自動登入；若仍未取得身分，顯示登入失敗狀態。
        // liff.login() 不可在 LIFF Browser 呼叫。
        initialized.value = true
      }
    } catch (e) {
      console.error('LIFF init failed', e)

      // liff.init() 在處理 liff.state 並呼叫 location.replace() 後會拋出錯誤（設計如此）。
      // 若頁面 URL 仍帶有 liff.state，代表 LIFF 已觸發 redirect 但尚未完成；
      // 此時等一小段時間讓 redirect 自然發生，若還沒跳走就手動補上 redirect，
      // 避免 userId = null → 觸發多餘的 liff.login() → LINE WebView 白畫面。
      const liffState = new URLSearchParams(window.location.search).get('liff.state')
      if (liffState) {
        await new Promise(resolve => setTimeout(resolve, 300))
        if (new URLSearchParams(window.location.search).has('liff.state')) {
          const targetHash = liffState.startsWith('#') ? liffState : '#' + liffState
          window.location.replace(window.location.origin + window.location.pathname + targetHash)
          return
        }
      }

      clearLiffLoginCallback()

      // 從通知連結進入時，liff.init() 會透過 hash change 完成 liff.state redirect（SPA 跳轉，不重載頁面），
      // 此時 LIFF auth 已完成但 liff.init() 已拋出，需在此補上 profile 取得。
      try {
        if (liff.isInClient() && liff.isLoggedIn()) {
          const profile = await getLiffProfile()
          applyLiffProfile(profile)
        }
      } catch (profileErr) {
        console.warn('LIFF profile fetch after liff.state redirect failed', profileErr)
      }

      if (!userId.value) {
        initialized.value = true
        return
      }

      initialized.value = true
    }
  }

  function initialize() {
    if (!initializationPromise) {
      initializationPromise = initializeClient()
    }
    return initializationPromise
  }

  async function getLineAccessToken() {
    await initialize()
    if (lineAccessToken.value) return lineAccessToken.value
    if (!import.meta.env.DEV && liff.isLoggedIn()) {
      lineAccessToken.value = liff.getAccessToken()
      return lineAccessToken.value
    }
    return null
  }

  async function updateGender(newGender) {
    if (!userId.value) return
    const value = newGender || null
    const lineToken = await getLineAccessToken()
    const ok = await updateMemberGender({ userId: userId.value, gender: value, lineAccessToken: lineToken })
    if (ok) gender.value = value
    else console.warn('updateGender error')
  }

  function login() {
    // 清空 singleton，確保跳轉回來後重新初始化（避免 same-page 跳轉時舊 promise 已完成）
    initializationPromise = null
    memberProfilePromise = null
    memberProfileInitialized.value = false
    liff.login({ redirectUri: window.location.href })
  }

  return {
    initialized,
    userId,
    displayName,
    pictureUrl,
    lineAccessToken,
    role,
    gender,
    isSeason,
    participationCount,
    memberProfileInitialized,
    pendingRedirect,
    getUserProfile,
    initialize,
    ensureMemberProfile,
    getLineAccessToken,
    login,
    updateGender,
  }
})
