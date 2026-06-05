import { ref, watch } from 'vue'
import { getMemberGenderMap } from '~/services/memberProfileService'
import { listPickupRegistrations, listRegistrationPayments, listSeasonRegistrations } from '~/services/registrationService'

async function mergeMemberGenders(registrations, liffStore) {
  if (!registrations.length) {
    return liffStore.userId && liffStore.gender ? { [liffStore.userId]: liffStore.gender } : {}
  }

  const userIds = [...new Set(registrations.map(registration => registration.user_id))]
  const genders = await getMemberGenderMap(userIds)
  if (liffStore.userId && liffStore.gender) genders[liffStore.userId] = liffStore.gender
  return genders
}

function mergeRegistrationPayments(registrations, payments) {
  if (!registrations.length || !payments.length) return registrations

  const paymentByRegistrationId = new Map(payments.map(payment => [payment.id, payment]))
  return registrations.map(registration => {
    const payment = paymentByRegistrationId.get(registration.id)
    if (!payment) return registration

    const guestPayments = payment.guests || []
    return {
      ...registration,
      paid_court: payment.paid_court,
      paid_ac: payment.paid_ac,
      guests: (registration.guests || []).map((guest, index) => ({
        ...guest,
        paid_court: guestPayments[index]?.paid_court,
        paid_ac: guestPayments[index]?.paid_ac,
      })),
    }
  })
}

export function useActiveActivityRegistrations({ activityData, activityType, resolvedDate, getActivityId, liffStore }) {
  const registrations = ref([])
  const cancelledRegistrations = ref([])
  const seasonRegistrations = ref([])
  const myRegistration = ref(null)
  const mySeasonRegistration = ref(null)
  const memberGenders = ref({})

  watch(
    () => liffStore.gender,
    newGender => {
      if (liffStore.userId && newGender) memberGenders.value = { ...memberGenders.value, [liffStore.userId]: newGender }
    }
  )

  async function fetchSeasonRegistrations(activityId) {
    const paymentPromise = listRegistrationPayments(liffStore, activityId)
    const data = mergeRegistrationPayments(await listSeasonRegistrations(activityId, ['active', 'cancelled']), await paymentPromise)

    const active = data.filter(registration => registration.status === 'active')
    const cancelled = data.filter(registration => registration.status === 'cancelled')
    registrations.value = active
    cancelledRegistrations.value = cancelled
    myRegistration.value = active.find(registration => registration.user_id === liffStore.userId) || null
    seasonRegistrations.value = active
    mySeasonRegistration.value = myRegistration.value
    memberGenders.value = await mergeMemberGenders(active, liffStore)
  }

  async function fetchPickupRegistrations(activityId) {
    const date = resolvedDate.value
    if (!date) return

    const paymentPromise = listRegistrationPayments(liffStore, activityId)
    const data = await listPickupRegistrations(activityId, date, ['active', 'cancelled'])
    const payments = await paymentPromise
    const dataWithPayments = mergeRegistrationPayments(data, payments)
    const active = dataWithPayments.filter(registration => registration.status === 'active')
    registrations.value = active
    cancelledRegistrations.value = dataWithPayments.filter(registration => registration.status === 'cancelled')
    myRegistration.value = active.find(registration => registration.user_id === liffStore.userId) || null
    memberGenders.value = await mergeMemberGenders(active, liffStore)

    const seasonData = await listSeasonRegistrations(activityId)
    seasonRegistrations.value = mergeRegistrationPayments(seasonData || [], payments)
    mySeasonRegistration.value = seasonRegistrations.value.find(registration => registration.user_id === liffStore.userId) || null

    const seasonUserIds = [...new Set((seasonData || []).map(registration => registration.user_id))].filter(id => !(id in memberGenders.value))
    if (!seasonUserIds.length) return

    memberGenders.value = {
      ...memberGenders.value,
      ...(await getMemberGenderMap(seasonUserIds)),
    }
  }

  async function fetchRegistrations() {
    const activityId = getActivityId() || activityData.value?.id
    if (!activityId) return

    if (activityType.value === 'season') {
      await fetchSeasonRegistrations(activityId)
      return
    }

    await fetchPickupRegistrations(activityId)
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
