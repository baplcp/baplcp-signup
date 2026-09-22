import { ref, watch } from 'vue'
import { getActivityPage } from '~/services/activityService'
import { getActivityRegistration } from '~/services/registrationService'

function mergeMemberGenders(registrations, liffStore) {
  const genders = Object.fromEntries(registrations.filter(registration => registration.member_gender).map(registration => [registration.user_id, registration.member_gender]))
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

  function getSelectedActivityDateId() {
    if (activityData.value?.selected_activity_date_id) return activityData.value.selected_activity_date_id

    const date = resolvedDate.value
    return activityData.value?.activity_dates?.find(activityDate => activityDate.activity_date === date)?.id || null
  }

  function getSeasonRegistrationState(data) {
    const active = data.filter(registration => !registration.cancelled_at)
    const cancelled = data.filter(registration => registration.cancelled_at)
    const myRegistration = active.find(registration => registration.user_id === liffStore.userId) || null

    return {
      registrations: data,
      cancelledRegistrations: cancelled,
      seasonRegistrations: data,
      myRegistration,
      mySeasonRegistration: myRegistration,
      memberGenders: mergeMemberGenders(data, liffStore),
    }
  }

  function getPickupRegistrationState(pickupData, seasonData) {
    const data = pickupData || []
    const active = data.filter(registration => !registration.cancelled_at)
    const myRegistration = active.find(registration => registration.user_id === liffStore.userId) || null
    const seasonRegistrations = seasonData || []
    const mySeasonRegistration = seasonRegistrations.find(registration => registration.user_id === liffStore.userId) || null

    return {
      registrations: data,
      cancelledRegistrations: data.filter(registration => registration.cancelled_at),
      seasonRegistrations,
      myRegistration,
      mySeasonRegistration,
      memberGenders: mergeMemberGenders([...data, ...seasonRegistrations], liffStore),
    }
  }

  function refreshDerivedState() {
    if (activityType.value === 'season') {
      myRegistration.value = registrations.value.find(registration => registration.user_id === liffStore.userId && !registration.cancelled_at) || null
      mySeasonRegistration.value = myRegistration.value
      memberGenders.value = mergeMemberGenders(registrations.value, liffStore)
      return
    }

    myRegistration.value = registrations.value.find(registration => registration.user_id === liffStore.userId && !registration.cancelled_at) || null
    mySeasonRegistration.value = seasonRegistrations.value.find(registration => registration.user_id === liffStore.userId && !registration.cancelled_at) || null
    memberGenders.value = mergeMemberGenders([...registrations.value, ...seasonRegistrations.value], liffStore)
  }

  function removeRegistration(registrationId) {
    registrations.value = registrations.value.filter(registration => registration.id !== registrationId)
    cancelledRegistrations.value = cancelledRegistrations.value.filter(registration => registration.id !== registrationId)
    seasonRegistrations.value = seasonRegistrations.value.filter(registration => registration.id !== registrationId)
  }

  function replaceRegistration(list, registration) {
    return [...list.filter(currentRegistration => currentRegistration.id !== registration.id), registration].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }

  function applyRegistration(registration) {
    const selectedActivityDateId = getSelectedActivityDateId()
    const isSeasonRegistration = registration.activity_date_id === null
    const isCurrentPickupRegistration = registration.activity_date_id === selectedActivityDateId

    removeRegistration(registration.id)
    if (activityType.value === 'season') {
      if (!isSeasonRegistration) return
      registrations.value = replaceRegistration(registrations.value, registration)
      if (registration.cancelled_at) cancelledRegistrations.value = replaceRegistration(cancelledRegistrations.value, registration)
      seasonRegistrations.value = registrations.value
      return
    }

    if (isSeasonRegistration) {
      seasonRegistrations.value = replaceRegistration(seasonRegistrations.value, registration)
      return
    }

    if (!isCurrentPickupRegistration) return
    registrations.value = replaceRegistration(registrations.value, registration)
    if (registration.cancelled_at) cancelledRegistrations.value = replaceRegistration(cancelledRegistrations.value, registration)
  }

  async function applyRegistrationChange(change) {
    const registrationId = change.new?.id || change.old?.id
    if (!registrationId) return

    if (change.eventType === 'DELETE') {
      removeRegistration(registrationId)
      refreshDerivedState()
      return
    }

    const registration = await getActivityRegistration(registrationId)
    if (!registration || registration.activity_id !== activityData.value?.id) return
    applyRegistration(registration)
    refreshDerivedState()
  }

  async function fetchRegistrations(activityPage = null) {
    const fetchId = ++latestFetchId
    const activityId = getActivityId() || activityData.value?.id
    if (!activityId) return

    const page = activityPage || (await getActivityPage(activityId, getSelectedActivityDateId()))
    if (!page?.activity) return null

    activityData.value = page.activity
    const nextState = activityType.value === 'season' ? getSeasonRegistrationState(page.season_registrations || []) : getPickupRegistrationState(page.pickup_registrations, page.season_registrations)
    if (fetchId !== latestFetchId || !nextState) return

    registrations.value = nextState.registrations
    cancelledRegistrations.value = nextState.cancelledRegistrations
    seasonRegistrations.value = nextState.seasonRegistrations
    myRegistration.value = nextState.myRegistration
    mySeasonRegistration.value = nextState.mySeasonRegistration
    memberGenders.value = nextState.memberGenders
    return page.activity
  }

  return {
    registrations,
    cancelledRegistrations,
    seasonRegistrations,
    myRegistration,
    mySeasonRegistration,
    memberGenders,
    fetchRegistrations,
    applyRegistrationChange,
  }
}
