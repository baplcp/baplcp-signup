import liff from '@line/liff'
import { ref } from 'vue'
import { LIFF_ID } from '~/config/env'

export const liffUser = ref(null)

export async function initLiff() {
  if (import.meta.env.DEV) {
    liffUser.value = { userId: 'dev-user-001', displayName: 'Dev User', pictureUrl: null }
    return
  }

  try {
    await liff.init({ liffId: LIFF_ID })
    if (liff.isLoggedIn()) {
      sessionStorage.removeItem('liff-login-attempted')
      const profile = await liff.getProfile()
      liffUser.value = { userId: profile.userId, displayName: profile.displayName, pictureUrl: profile.pictureUrl }
    } else if (!sessionStorage.getItem('liff-login-attempted')) {
      sessionStorage.setItem('liff-login-attempted', '1')
      liff.login({ redirectUri: window.location.href })
    }
  } catch (e) {
    console.error('LIFF init failed', e)
  }
}

export function loginLiff() {
  liff.login({ redirectUri: window.location.href })
}
