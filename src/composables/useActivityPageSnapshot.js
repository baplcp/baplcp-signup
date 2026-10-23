import { computed, ref, watch } from 'vue'
import { seasonPlanCoversDate } from '../utils/seasonPlan.js'
import { getTaiwanDateString } from '../utils/taiwanDate.js'

function memberGenders(registrations, liffStore) {
  const genders = Object.fromEntries(registrations.filter(registration => registration.member_gender).map(registration => [registration.user_id, registration.member_gender]))
  if (liffStore.userId && liffStore.gender) genders[liffStore.userId] = liffStore.gender
  return genders
}

function selectedDate(activity) {
  if (!activity) return null
  if (activity.selected_activity_date) return activity.selected_activity_date
  const dates = [...(activity.dates || [])].sort()
  const today = getTaiwanDateString()
  return dates.find(date => date >= today) || dates[dates.length - 1] || null
}

function registrationState(page, season, liffStore) {
  const activity = page.activity
  const seasonRegistrations = page.season_registrations || []
  if (season) {
    const mine = seasonRegistrations.filter(registration => registration.user_id === liffStore.userId && registration.is_self_registration && !registration.cancelled_at)
    return {
      registrations: seasonRegistrations,
      cancelledRegistrations: seasonRegistrations.filter(registration => registration.cancelled_at),
      seasonRegistrations,
      myRegistration: mine[0] || null,
      mySeasonRegistration: mine[0] || null,
      mySeasonRegistrations: mine,
      memberGenders: memberGenders(seasonRegistrations, liffStore),
    }
  }

  const registrations = page.pickup_registrations || []
  const mine = registrations.find(registration => registration.user_id === liffStore.userId && (!registration.cancelled_at || registration.guests?.some(guest => !guest.cancelled_at))) || null
  const mySeasonRegistrations = seasonRegistrations.filter(registration => registration.user_id === liffStore.userId && !registration.cancelled_at)
  const mySeasonRegistration = mySeasonRegistrations.find(registration => seasonPlanCoversDate(registration.season_plan, selectedDate(activity), activity.dates)) || null
  return {
    registrations,
    cancelledRegistrations: registrations.filter(registration => registration.cancelled_at),
    seasonRegistrations,
    myRegistration: mine,
    mySeasonRegistration,
    mySeasonRegistrations,
    memberGenders: memberGenders([...registrations, ...seasonRegistrations], liffStore),
  }
}

export function useActivityPageSnapshot({ liffStore, loadPage, subscribe, unsubscribe, refreshDelay = 750 }) {
  const activityData = ref(null)
  const resolvedDate = computed(() => selectedDate(activityData.value))
  const activityLoadState = ref('loading')
  const registrations = ref([])
  const cancelledRegistrations = ref([])
  const seasonRegistrations = ref([])
  const myRegistration = ref(null)
  const mySeasonRegistration = ref(null)
  const mySeasonRegistrations = ref([])
  const genders = ref({})
  const acEnabled = ref(false)
  const acFeePerSession = ref(0)
  const isStale = ref(false)

  let key = null
  let pageEpoch = 0
  let revision = 0
  let channel = null
  let refreshTimer = null
  let refreshInFlight = false
  let refreshPending = false
  let lastPage = null
  let lastSeason = false
  const paymentOverrides = new Map()
  const confirmedPayments = new Map()
  const pendingPayments = new Set()
  let pendingAcEpoch = null
  let acOverride = null
  let confirmedAc = null

  const stopGenderWatch = watch(
    () => liffStore.gender,
    gender => {
      if (liffStore.userId && gender) genders.value = { ...genders.value, [liffStore.userId]: gender }
    }
  )

  function clearSubscription() {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = null
    refreshPending = false
    if (channel) unsubscribe(channel)
    channel = null
  }

  function applyPaymentOverrides(list) {
    return list.map(registration => {
      const fields = paymentOverrides.get(registration.id)
      const guests = registration.guests?.map(guest => {
        const guestFields = paymentOverrides.get(`guest:${guest.id}`)
        return guestFields ? { ...guest, ...guestFields } : guest
      })
      return fields || guests ? { ...registration, ...fields, ...(guests ? { guests } : {}) } : registration
    })
  }

  function returnedPayment(page, key, field) {
    const all = [...(page.pickup_registrations || []), ...(page.season_registrations || [])]
    const item = String(key).startsWith('guest:')
      ? all.flatMap(registration => registration.guests || []).find(guest => String(guest.id) === String(key).slice(6))
      : all.find(registration => String(registration.id) === String(key))
    return { found: !!item, value: item?.[field] ?? false }
  }

  function applyPage(page, season, currentRevision) {
    if (!page?.activity || !Array.isArray(page.season_registrations) || (!season && !Array.isArray(page.pickup_registrations))) throw new Error('invalid_activity_page')
    for (const [registrationId, fields] of confirmedPayments) {
      for (const [field, confirmed] of Object.entries(fields)) {
        const returned = returnedPayment(page, registrationId, field)
        if (currentRevision > confirmed.revision && (!returned.found || returned.value === confirmed.value)) settlePayment(registrationId, field)
      }
    }
    if (confirmedAc && currentRevision > confirmedAc.revision && page.activity.ac_enabled === confirmedAc.value) {
      acOverride = null
      confirmedAc = null
    }
    const next = registrationState(page, season, liffStore)
    lastPage = page
    lastSeason = season
    activityData.value = page.activity
    acEnabled.value = acOverride ?? page.activity.ac_enabled ?? false
    acFeePerSession.value = page.activity.ac_fee ?? 0
    registrations.value = applyPaymentOverrides(next.registrations)
    cancelledRegistrations.value = next.cancelledRegistrations
    seasonRegistrations.value = applyPaymentOverrides(next.seasonRegistrations)
    myRegistration.value = next.myRegistration
    mySeasonRegistration.value = next.mySeasonRegistration
    mySeasonRegistrations.value = next.mySeasonRegistrations
    genders.value = next.memberGenders
    activityLoadState.value = 'ready'
    isStale.value = confirmedPayments.size > 0 || confirmedAc !== null
  }

  async function load(currentKey, initial) {
    const currentRevision = ++revision
    try {
      const pagePromise = loadPage(currentKey.id, currentKey.dateId, currentKey.season)
      const page = initial ? (await Promise.all([liffStore.initialize(), pagePromise]))[1] : await pagePromise
      if (currentRevision !== revision) return false
      if (!page?.activity) {
        if (initial) activityLoadState.value = 'not-found'
        else throw new Error('activity_not_found')
        return false
      }
      if (String(page.activity.id) !== String(currentKey.id)) throw new Error('activity_id_mismatch')
      applyPage(page, currentKey.season, currentRevision)
      if (initial) {
        channel = subscribe(page.activity.id, scheduleRefresh, {
          includeGuests: !currentKey.season,
          seasonOnly: currentKey.season,
          selectedDateId: page.activity.selected_activity_date_id,
        })
      }
      return true
    } catch (error) {
      if (currentRevision !== revision) return false
      if (initial) activityLoadState.value = 'error'
      else isStale.value = true
      throw error
    }
  }

  async function open(nextKey) {
    clearSubscription()
    revision++
    key = { ...nextKey }
    pageEpoch++
    lastPage = null
    paymentOverrides.clear()
    confirmedPayments.clear()
    pendingPayments.clear()
    pendingAcEpoch = null
    acOverride = null
    confirmedAc = null
    activityLoadState.value = 'loading'
    activityData.value = null
    registrations.value = []
    cancelledRegistrations.value = []
    seasonRegistrations.value = []
    myRegistration.value = null
    mySeasonRegistration.value = null
    mySeasonRegistrations.value = []
    genders.value = {}
    acEnabled.value = false
    acFeePerSession.value = 0
    isStale.value = false
    return load(key, true)
  }

  async function refresh() {
    if (!key || activityLoadState.value !== 'ready') return false
    return load(key, false)
  }

  async function flushRefresh() {
    if (refreshInFlight) {
      refreshPending = true
      return
    }
    refreshInFlight = true
    try {
      await refresh()
    } catch (error) {
      console.warn('Unable to refresh activity registration', error)
    } finally {
      refreshInFlight = false
      if (refreshPending) {
        refreshPending = false
        scheduleRefresh()
      }
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      void flushRefresh()
    }, refreshDelay)
  }

  function setPayment(registrationId, field, value) {
    const fields = paymentOverrides.get(registrationId) || {}
    paymentOverrides.set(registrationId, { ...fields, [field]: value })
    reapplyLocalChanges()
  }

  function confirmPayment(registrationId, field) {
    const fields = confirmedPayments.get(registrationId) || {}
    confirmedPayments.set(registrationId, { ...fields, [field]: { revision, value: paymentOverrides.get(registrationId)?.[field] } })
  }

  async function updatePayment(member, field, write) {
    const paymentId = member._memberType === 'guest' ? `guest:${member._guestId}` : member._regId
    const pendingKey = `${pageEpoch}:${paymentId}:${field}`
    if (!key || pendingPayments.has(pendingKey)) return false
    const token = pageEpoch
    const registration = member._memberType === 'guest' ? null : (member._memberType === 'season_self' ? seasonRegistrations.value : registrations.value).find(item => item.id === member._regId)
    if (paymentId == null || (member._memberType !== 'guest' && !registration)) return false
    const previousValue = member._memberType === 'guest' ? ((field === 'paid_court' ? member.paidCourt : member.paidAc) ?? false) : (registration[field] ?? false)
    pendingPayments.add(pendingKey)
    setPayment(paymentId, field, !previousValue)
    try {
      try {
        await write()
      } catch (error) {
        if (token !== pageEpoch) return false
        setPayment(paymentId, field, previousValue)
        settlePayment(paymentId, field)
        throw error
      }
      if (token !== pageEpoch) return false
      confirmPayment(paymentId, field)
      try {
        await refresh()
      } catch {
        // Keep the confirmed optimistic value until a later read succeeds.
      }
      return true
    } finally {
      pendingPayments.delete(pendingKey)
    }
  }

  async function updateAcEnabled(enabled, write) {
    if (!key || pendingAcEpoch === pageEpoch) return false
    const token = pageEpoch
    pendingAcEpoch = token
    setAcEnabled(enabled)
    try {
      try {
        await write()
      } catch (error) {
        if (token !== pageEpoch) return false
        settleAcEnabled()
        throw error
      }
      if (token !== pageEpoch) return false
      confirmAcEnabled()
      try {
        await refresh()
      } catch {
        // Keep the confirmed optimistic value until a later read succeeds.
      }
      return true
    } finally {
      if (pendingAcEpoch === token) pendingAcEpoch = null
    }
  }

  function reapplyLocalChanges() {
    if (!lastPage) return
    const next = registrationState(lastPage, lastSeason, liffStore)
    registrations.value = applyPaymentOverrides(next.registrations)
    seasonRegistrations.value = applyPaymentOverrides(next.seasonRegistrations)
    myRegistration.value = applyPaymentOverrides([next.myRegistration].filter(Boolean))[0] || null
    mySeasonRegistration.value = applyPaymentOverrides([next.mySeasonRegistration].filter(Boolean))[0] || null
    mySeasonRegistrations.value = applyPaymentOverrides(next.mySeasonRegistrations)
  }

  function settlePayment(registrationId, field) {
    const fields = paymentOverrides.get(registrationId)
    if (!fields) return
    delete fields[field]
    if (!Object.keys(fields).length) paymentOverrides.delete(registrationId)
    const confirmed = confirmedPayments.get(registrationId)
    if (confirmed) {
      delete confirmed[field]
      if (!Object.keys(confirmed).length) confirmedPayments.delete(registrationId)
    }
    reapplyLocalChanges()
  }

  function setAcEnabled(value) {
    acOverride = value
    acEnabled.value = value
  }

  function confirmAcEnabled() {
    confirmedAc = { revision, value: acOverride }
  }

  function settleAcEnabled() {
    acOverride = null
    confirmedAc = null
    if (lastPage) acEnabled.value = lastPage.activity.ac_enabled ?? false
  }

  function dispose() {
    revision++
    pageEpoch++
    key = null
    pendingPayments.clear()
    pendingAcEpoch = null
    clearSubscription()
    stopGenderWatch()
  }

  return {
    activityData,
    resolvedDate,
    activityLoadState,
    registrations,
    cancelledRegistrations,
    seasonRegistrations,
    myRegistration,
    mySeasonRegistration,
    mySeasonRegistrations,
    memberGenders: genders,
    acEnabled,
    acFeePerSession,
    isStale,
    open,
    refresh,
    updatePayment,
    updateAcEnabled,
    dispose,
  }
}
