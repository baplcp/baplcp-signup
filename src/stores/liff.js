import liff from '@line/liff'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const LIFF_ID = '2009808077-q6H0su3r'

let initializationPromise = null

export const useLiffStore = defineStore('liff', () => {
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref(null)
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
    loading.value = true
    error.value = null

    try {
      if (import.meta.env.DEV) {
        userId.value = 'dev-user-001'
        displayName.value = 'Dev User'
        pictureUrl.value = null
        initialized.value = true
        return getUserProfile()
      }

      await liff.init({ liffId: LIFF_ID })

      if (!liff.isLoggedIn()) {
        liff.login()
        return null
      }

      const profile = await liff.getProfile()
      userId.value = profile.userId
      displayName.value = profile.displayName
      pictureUrl.value = profile.pictureUrl
      initialized.value = true
      return getUserProfile()
    } catch (initError) {
      console.error('LIFF init failed', initError)
      error.value = initError
      initialized.value = false
      return null
    } finally {
      loading.value = false
    }
  }

  function initialize() {
    if (!initializationPromise) {
      initializationPromise = initializeClient()
    }

    return initializationPromise
  }

  return {
    initialized,
    loading,
    error,
    userId,
    displayName,
    pictureUrl,
    initialize,
  }
})
