import liff from '@line/liff'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '~/utils/supabase'

const LIFF_ID = '2009808077-q6H0su3r'

let initializationPromise = null

export const useLiffStore = defineStore('liff', () => {
  const initialized = ref(false)
  const userId = ref(null)
  const displayName = ref(null)
  const pictureUrl = ref(null)
  const role = ref('member')
  const gender = ref(null)
  const isExternalBrowser = ref(false)

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
      const { data, error } = await supabase
        .from('members')
        .select('role, gender')
        .eq('user_id', uid)
        .maybeSingle()

      if (error) {
        console.warn('syncMember select error', error.message)
        return
      }

      if (data) {
        // 已有記錄：直接讀取 role 與 gender，不覆蓋管理員設定
        role.value = data.role
        gender.value = data.gender || null
      } else {
        // 第一次登入：自動新增，role 預設 guest
        const { error: insertError } = await supabase
          .from('members')
          .insert({ user_id: uid, display_name: name, role: 'member' })
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
      // 開發時若需要測試特定角色，可改為 role.value = 'admin'
      await syncMember('dev-user-001', 'Dev User')
      initialized.value = true
      return
    }

    try {
      await liff.init({ liffId: LIFF_ID })

      if (!liff.isInClient()) {
        // 外部瀏覽器（電腦版、行動版非 LINE 瀏覽器）
        // LINE 平台限制：行動版外部瀏覽器無法透過 LIFF 登入，不發起跳轉
        isExternalBrowser.value = true
        if (liff.isLoggedIn()) {
          // token 尚未過期的極少數情況，直接讀取 profile
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
        initialized.value = true
      } else if (!sessionStorage.getItem('liff-login-attempted')) {
        sessionStorage.setItem('liff-login-attempted', '1')
        liff.login({ redirectUri: window.location.href })
      }
    } catch (e) {
      console.error('LIFF init failed', e)
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
    const { error } = await supabase
      .from('members')
      .update({ gender: value })
      .eq('user_id', userId.value)
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
    isExternalBrowser,
    getUserProfile,
    initialize,
    login,
    updateGender,
  }
})
