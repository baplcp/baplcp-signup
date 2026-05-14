import liff from '@line/liff'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const LIFF_ID = '2009808077-q6H0su3r'

let initializationPromise = null

export const useLiffStore = defineStore('liff', () => {
  const initialized = ref(false)
  const userId = ref(null)
  const displayName = ref(null)
  const pictureUrl = ref(null)

  function getUserProfile() {
    return {
      userId: userId.value,
      displayName: displayName.value,
      pictureUrl: pictureUrl.value,
    }
  }

  async function initializeClient() {
    if (import.meta.env.DEV) {
      userId.value = 'dev-user-001'
      displayName.value = 'Dev User'
      pictureUrl.value = null
      initialized.value = true
      return
    }

    try {
      await liff.init({ liffId: LIFF_ID })

      if (liff.isLoggedIn()) {
        sessionStorage.removeItem('liff-login-attempted')
        const profile = await liff.getProfile()
        userId.value = profile.userId
        displayName.value = profile.displayName
        pictureUrl.value = profile.pictureUrl
        initialized.value = true
      } else if (!sessionStorage.getItem('liff-login-attempted')) {
        sessionStorage.setItem('liff-login-attempted', '1')
        liff.login({ redirectUri: window.location.href })
      }
    } catch (e) {
      console.error('LIFF init failed', e)
    }
  }

  function initialize() {
    if (!initializationPromise) {
      initializationPromise = initializeClient()
    }
    return initializationPromise
  }

  function login() {
    liff.login({ redirectUri: window.location.href })
  }

  return {
    initialized,
    userId,
    displayName,
    pictureUrl,
    getUserProfile,
    initialize,
    login,
  }
})
