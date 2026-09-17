import { ref, watch } from 'vue'
import { getMemberGenderMap } from '~/services/memberProfileService'
import { listPickupRegistrations, listSeasonRegistrations } from '~/services/registrationService'

async function mergeMemberGenders(registrations, liffStore) {
  if (!registrations.length) {
    return liffStore.userId && liffStore.gender ? { [liffStore.userId]: liffStore.gender } : {}
  }

  const userIds = [...new Set(registrations.map(registration => registration.user_id))]
  const genders = await getMemberGenderMap(userIds)
  if (liffStore.userId && liffStore.gender) genders[liffStore.userId] = liffStore.gender
  return genders
}

export function useActiveActivityRegistrations({ activityData, activityType, resolvedDate, getActivityId, liffStore }) {
  const registrations = ref([])
  const cancelledRegistrations = ref([])
  const seasonRegistrations = ref([])
  const myRegistration = ref(null)
  const mySeasonRegistration = ref(null)
  const memberGenders = ref({})
  let latestFetchId = 0

  watch(
    () => liffStore.gender,
    newGender => {
      if (liffStore.userId && newGender) memberGenders.value = { ...memberGenders.value, [liffStore.userId]: newGender }
    }
  )

  async function fetchSeasonRegistrations(activityId) {
    const data = await listSeasonRegistrations(activityId, ['active', 'cancelled'])

    const active = data.filter(registration => registration.status === 'active')
    const cancelled = data.filter(registration => registration.status === 'cancelled')
    const myRegistration = active.find(registration => registration.user_id === liffStore.userId) || null

    return {
      registrations: active,
      cancelledRegistrations: cancelled,
      seasonRegistrations: active,
      myRegistration,
      mySeasonRegistration: myRegistration,
      memberGenders: await mergeMemberGenders(active, liffStore),
    }
  }

  async function fetchPickupRegistrations(activityId) {
    const date = resolvedDate.value
    if (!date) return

    const data = await listPickupRegistrations(activityId, date, ['active', 'cancelled'])
    const active = data.filter(registration => registration.status === 'active')
    const myRegistration = active.find(registration => registration.user_id === liffStore.userId) || null
    let genders = await mergeMemberGenders(active, liffStore)

    const seasonData = await listSeasonRegistrations(activityId)
    const seasonRegistrations = seasonData || []
    const mySeasonRegistration = seasonRegistrations.find(registration => registration.user_id === liffStore.userId) || null

    const seasonUserIds = [...new Set(seasonRegistrations.map(registration => registration.user_id))].filter(id => !(id in genders))
    if (seasonUserIds.length) {
      genders = {
        ...genders,
        ...(await getMemberGenderMap(seasonUserIds)),
      }
    }

    return {
      registrations: active,
      cancelledRegistrations: data.filter(registration => registration.status === 'cancelled'),
      seasonRegistrations,
      myRegistration,
      mySeasonRegistration,
      memberGenders: genders,
    }
  }

  async function fetchRegistrations() {
    const fetchId = ++latestFetchId
    const activityId = getActivityId() || activityData.value?.id
    if (!activityId) return

    const nextState = activityType.value === 'season' ? await fetchSeasonRegistrations(activityId) : await fetchPickupRegistrations(activityId)
    if (fetchId !== latestFetchId || !nextState) return

    registrations.value = nextState.registrations
    cancelledRegistrations.value = nextState.cancelledRegistrations
    seasonRegistrations.value = nextState.seasonRegistrations
    myRegistration.value = nextState.myRegistration
    mySeasonRegistration.value = nextState.mySeasonRegistration
    memberGenders.value = nextState.memberGenders
  }

  return {
    registrations,
    cancelledRegistrations,
    seasonRegistrations,
    myRegistration,
    mySeasonRegistration,
    memberGenders,
    fetchRegistrations,
  }
}
