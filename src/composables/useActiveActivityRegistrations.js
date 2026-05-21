import { ref, watch } from 'vue'
import { supabase } from '~/utils/supabase'

async function mergeMemberGenders(registrations, liffStore) {
  if (!registrations.length) {
    return liffStore.userId && liffStore.gender ? { [liffStore.userId]: liffStore.gender } : {}
  }

  const userIds = [...new Set(registrations.map(registration => registration.user_id))]
  const { data } = await supabase.from('members').select('user_id, gender').in('user_id', userIds)
  const genders = data ? Object.fromEntries(data.map(member => [member.user_id, member.gender || null])) : {}
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

  watch(
    () => liffStore.gender,
    newGender => {
      if (liffStore.userId && newGender) memberGenders.value = { ...memberGenders.value, [liffStore.userId]: newGender }
    }
  )

  async function fetchSeasonRegistrations(activityId) {
    const { data } = await supabase
      .from('registrations')
      .select('*')
      .eq('activity_id', activityId)
      .is('activity_date', null)
      .in('status', ['active', 'cancelled'])
      .order('created_at', { ascending: true })
    if (!data) return

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

    const { data } = await supabase
      .from('registrations')
      .select('*')
      .eq('activity_id', activityId)
      .eq('activity_date', date)
      .in('status', ['active', 'cancelled'])
      .order('created_at', { ascending: true })
    if (data) {
      const active = data.filter(registration => registration.status === 'active')
      registrations.value = active
      cancelledRegistrations.value = data.filter(registration => registration.status === 'cancelled')
      myRegistration.value = active.find(registration => registration.user_id === liffStore.userId) || null
      memberGenders.value = await mergeMemberGenders(active, liffStore)
    }

    const { data: seasonData } = await supabase
      .from('registrations')
      .select('*')
      .eq('activity_id', activityId)
      .is('activity_date', null)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    seasonRegistrations.value = seasonData || []
    mySeasonRegistration.value = seasonData?.find(registration => registration.user_id === liffStore.userId) || null

    const seasonUserIds = [...new Set((seasonData || []).map(registration => registration.user_id))].filter(id => !(id in memberGenders.value))
    if (!seasonUserIds.length) return

    const { data: seasonMemberData } = await supabase.from('members').select('user_id, gender').in('user_id', seasonUserIds)
    if (!seasonMemberData) return

    memberGenders.value = {
      ...memberGenders.value,
      ...Object.fromEntries(seasonMemberData.map(member => [member.user_id, member.gender || null])),
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
