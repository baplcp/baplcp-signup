import { ref, watch } from 'vue'
import { getActivityPage } from '~/services/activityService'
import { seasonPlanCoversDate } from '~/utils/seasonPlan'

function mergeMemberGenders(registrations, liffStore) {
  const genders = Object.fromEntries(registrations.filter(registration => registration.member_gender).map(registration => [registration.user_id, registration.member_gender]))
  if (liffStore.userId && liffStore.gender) genders[liffStore.userId] = liffStore.gender
  return genders
}

export function useActiveActivityRegistrations({ activityData, activityType, resolvedDate, getActivityId, liffStore, loadActivityPage = getActivityPage }) {
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
    const myRegistration = active.find(registration => registration.user_id === liffStore.userId && registration.is_self_registration) || null

    return {
      registrations: data,
      cancelledRegistrations: cancelled,
      seasonRegistrations: data,
      myRegistration,
      mySeasonRegistration: myRegistration,
      memberGenders: mergeMemberGenders(data, liffStore),
    }
  }

  function getPickupRegistrationState(pickupData, seasonData, activityDates) {
    const data = pickupData || []
    const myRegistration = data.find(registration => registration.user_id === liffStore.userId && (!registration.cancelled_at || registration.guests?.some(guest => !guest.cancelled_at))) || null
    const seasonRegistrations = seasonData || []
    // 取消後重新報名季打會產生新的一筆報名，請假狀態要以目前有效的那筆為準；
    // 方案沒涵蓋的場次（例如後季成員看 9 月場）就不是季打成員，應走一般臨打報名。
    const mySeasonRegistration =
      seasonRegistrations.find(
        registration => registration.user_id === liffStore.userId && !registration.cancelled_at && seasonPlanCoversDate(registration.season_plan, resolvedDate.value, activityDates)
      ) || null

    return {
      registrations: data,
      cancelledRegistrations: data.filter(registration => registration.cancelled_at),
      seasonRegistrations,
      myRegistration,
      mySeasonRegistration,
      memberGenders: mergeMemberGenders([...data, ...seasonRegistrations], liffStore),
    }
  }

  async function fetchRegistrations(activityPage = null) {
    const fetchId = ++latestFetchId
    const activityId = getActivityId() || activityData.value?.id
    if (!activityId) return

    const page = activityPage || (await loadActivityPage(activityId, getSelectedActivityDateId()))
    if (!page?.activity) return null

    activityData.value = page.activity
    const nextState =
      activityType.value === 'season'
        ? getSeasonRegistrationState(page.season_registrations || [])
        : getPickupRegistrationState(page.pickup_registrations, page.season_registrations, page.activity.dates)
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
  }
}
