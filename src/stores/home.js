import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getLatestActivitySession } from '~/services/activityService'
import { countPastParticipations } from '~/services/registrationService'

export const useHomeStore = defineStore('home', () => {
  const latestActivitySession = ref(null)
  const hasLatestActivitySession = ref(false)
  const participationCounts = ref({})
  let latestActivitySessionPromise = null
  const participationCountPromises = new Map()

  async function loadLatestActivitySession() {
    if (hasLatestActivitySession.value) return latestActivitySession.value
    if (latestActivitySessionPromise) return latestActivitySessionPromise

    latestActivitySessionPromise = getLatestActivitySession()
      .then(session => {
        latestActivitySession.value = session
        hasLatestActivitySession.value = true
        return session
      })
      .finally(() => {
        latestActivitySessionPromise = null
      })

    return latestActivitySessionPromise
  }

  async function loadParticipationCount(userId) {
    if (!userId) return 0
    if (Object.hasOwn(participationCounts.value, userId)) return participationCounts.value[userId]
    if (participationCountPromises.has(userId)) return participationCountPromises.get(userId)

    const promise = countPastParticipations(userId)
      .then(count => {
        participationCounts.value = { ...participationCounts.value, [userId]: count }
        return count
      })
      .finally(() => {
        participationCountPromises.delete(userId)
      })

    participationCountPromises.set(userId, promise)
    return promise
  }

  return {
    latestActivitySession,
    loadLatestActivitySession,
    loadParticipationCount,
  }
})
