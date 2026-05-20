import liff from '@line/liff'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '~/utils/supabase'
import { consumeOAuthCallback, popPostOAuthRedirect, LINE_OAUTH_REDIRECT_URI } from '~/utils/lineOAuth'

const LIFF_ID = '2009808077-q6H0su3r'

let initializationPromise = null

export const useLiffStore = defineStore('liff', () => {
  const initialized = ref(false)
  const userId = ref(null)
  const displayName = ref(null)
  const pictureUrl = ref(null)
  const role = ref('member')
  const gender = ref(null)
  const isSeason = ref(false)
  const isExternalBrowser = ref(false)
  const pendingRedirect = ref(null)

  function getUserProfile() {
    return {
      userId: userId.value,
      displayName: displayName.value,
      pictureUrl: pictureUrl.value,
    }
  }

  // 登入時同步 members 表：找到就讀取 role，找不到就自動新增（role 預設 guest）
  async function syncMember(uid, name) {
    if (!uid) return
    try {
      const { data, error } = await supabase.from('members').select('role, gender, is_season').eq('user_id', uid).maybeSingle()

      if (error) {
        console.warn('syncMember select error', error.message)
        return
      }

      if (data) {
        // 已有記錄：直接讀取 role 與 gender，不覆蓋管理員設定
        role.value = data.role
        gender.value = data.gender || null

        // 自動同步 is_season：依據使用者是否在最新季打 activity 有 active 報名
        const { data: latestSeason } = await supabase.from('activities').select('id').eq('season_enabled', true).order('created_at', { ascending: false }).limit(1).maybeSingle()

        if (latestSeason) {
          const { data: seasonReg } = await supabase
            .from('registrations')
            .select('id')
            .eq('activity_id', latestSeason.id)
            .eq('user_id', uid)
            .is('activity_date', null)
            .eq('status', 'active')
            .maybeSingle()
          const newIsSeason = !!seasonReg
          if (newIsSeason !== data.is_season) {
            await supabase.from('members').update({ is_season: newIsSeason }).eq('user_id', uid)
          }
          isSeason.value = newIsSeason
        } else {
          isSeason.value = data.is_season ?? false
        }
      } else {
        // 第一次登入：自動新增，role 預設 guest
        const { error: insertError } = await supabase.from('members').insert({ user_id: uid, display_name: name, role: 'member' })
        if (insertError) {
          console.warn('syncMember insert error', insertError.message)
        }
        role.value = 'member'
      }
    } catch (e) {
      console.warn('syncMember exception', e)
    }
  }

  async function initializeClient() {
    if (import.meta.env.DEV) {
      userId.value = 'dev-user-001'
      displayName.value = 'Dev User'
      pictureUrl.value = null
      await syncMember('dev-user-001', 'Dev User')
      initialized.value = true
      return
    }

    // 在 liff.init() 之前先檢查 LINE OAuth callback，
    // 避免 LIFF SDK 把 ?code 參數誤判為自己的 OAuth 並消耗掉
    const oauthCode = consumeOAuthCallback()
    if (oauthCode) {
      isExternalBrowser.value = true
      try {
        const { data, error } = await supabase.functions.invoke('line-token', {
          body: { code: oauthCode, redirectUri: LINE_OAUTH_REDIRECT_URI },
        })
        if (!error && data?.userId) {
          userId.value = data.userId
          displayName.value = data.displayName
          pictureUrl.value = data.pictureUrl ?? null
          await syncMember(data.userId, data.displayName)
          initialized.value = true
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

    try {
      await liff.init({ liffId: LIFF_ID })

      if (!liff.isInClient()) {
        // 外部瀏覽器（電腦版、行動版非 LINE 瀏覽器）
        isExternalBrowser.value = true

        // 已透過 LIFF token（極少數情況）登入
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          userId.value = profile.userId
          displayName.value = profile.displayName
          pictureUrl.value = profile.pictureUrl
          await syncMember(profile.userId, profile.displayName)
        }

        initialized.value = true
        return
      }

      // LINE 內部瀏覽器 — 正常 LIFF 流程
      if (liff.isLoggedIn()) {
        sessionStorage.removeItem('liff-login-attempted')
        const profile = await liff.getProfile()
        userId.value = profile.userId
        displayName.value = profile.displayName
        pictureUrl.value = profile.pictureUrl
        await syncMember(profile.userId, profile.displayName)

        // LIFF auth 後回到首頁時，還原 auth 前的 hash 路由
        const savedHash = sessionStorage.getItem('liff-post-login-hash')
        if (savedHash) {
          sessionStorage.removeItem('liff-post-login-hash')
          const path = savedHash.startsWith('#') ? savedHash.slice(1) : savedHash
          pendingRedirect.value = path
        }

        initialized.value = true
      } else if (!sessionStorage.getItem('liff-login-attempted')) {
        sessionStorage.setItem('liff-login-attempted', '1')
        // 儲存目前的 hash 路由，讓 auth 回來後可以還原（OAuth redirect 不保留 hash fragment）
        const currentHash = window.location.hash
        if (currentHash && currentHash !== '#/' && currentHash !== '#') {
          sessionStorage.setItem('liff-post-login-hash', currentHash)
        }
        liff.login({ redirectUri: window.location.href })
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

      initialized.value = true
    }
  }

  function initialize() {
    if (!initializationPromise) {
      initializationPromise = initializeClient()
    }
    return initializationPromise
  }

  async function updateGender(newGender) {
    if (!userId.value) return
    const value = newGender || null
    const { error } = await supabase.from('members').update({ gender: value }).eq('user_id', userId.value)
    if (!error) gender.value = value
    else console.warn('updateGender error', error.message)
  }

  function login() {
    // 清空 singleton，確保跳轉回來後重新初始化（避免 same-page 跳轉時舊 promise 已完成）
    initializationPromise = null
    liff.login({ redirectUri: window.location.href })
  }

  return {
    initialized,
    userId,
    displayName,
    pictureUrl,
    role,
    gender,
    isSeason,
    isExternalBrowser,
    pendingRedirect,
    getUserProfile,
    initialize,
    login,
    updateGender,
  }
})
