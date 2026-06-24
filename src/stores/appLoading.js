import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppLoadingStore = defineStore('appLoading', () => {
  // 頁面資料載入中時設為 true，載完後設回 false
  const pageLoading = ref(false)
  return { pageLoading }
})
