import { computed, reactive, ref, watch } from 'vue'

function toGuestForm(guests = []) {
  return guests.filter(guest => !guest.cancelled_at).map(guest => ({ id: guest.id, name: guest.name || '', gender: guest.gender || '' }))
}

function hasActiveSelfRegistration(registration) {
  return Boolean(registration?.is_self_registration && !registration.cancelled_at)
}

function syncGuestLength(signupState, count) {
  while (signupState.guests.length < count) signupState.guests.push({ name: '', gender: '' })
  signupState.guests.splice(count)
}

export function useSignupFormState({ isAdmin, myRegistration, mySeasonRegistration, resolvedDate, viewModels }) {
  const signupState = reactive({ self: 0, guest: 0, guests: [] })
  const showGuestValidation = ref(false)
  const selectedSeasonPlan = ref('quarter')

  watch(
    myRegistration,
    reg => {
      if (reg?.season_plan) selectedSeasonPlan.value = reg.season_plan
    },
    { immediate: true }
  )

  const isSignupChanged = computed(() => {
    const currentViewModels = viewModels.value
    if (!currentViewModels) return false

    if (currentViewModels.isSeasonLeaveMode.value) {
      const isOnLeave = (mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value)
      if ((signupState.self === 0) !== isOnLeave) return true
    } else if (signupState.self !== (hasActiveSelfRegistration(myRegistration.value) ? 1 : 0)) {
      return true
    }

    const previousGuests = toGuestForm(myRegistration.value?.guests)
    if (signupState.guest !== previousGuests.length) return true
    for (let index = 0; index < signupState.guest; index += 1) {
      const current = signupState.guests[index] || { name: '', gender: '' }
      const previous = previousGuests[index] || { name: '', gender: '' }
      if ((current.name || '') !== (previous.name || '') || (current.gender || '') !== (previous.gender || '')) return true
    }
    return false
  })

  function resetSignupState() {
    showGuestValidation.value = false
    if (viewModels.value.isSeasonLeaveMode.value) {
      const isOnLeave = (mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value)
      signupState.self = isOnLeave ? 0 : 1
      signupState.guest = toGuestForm(myRegistration.value?.guests).length
      signupState.guests = toGuestForm(myRegistration.value?.guests)
    } else if (myRegistration.value) {
      signupState.self = hasActiveSelfRegistration(myRegistration.value) ? 1 : 0
      signupState.guest = toGuestForm(myRegistration.value.guests).length
      signupState.guests = toGuestForm(myRegistration.value.guests)
    } else {
      signupState.self = 0
      signupState.guest = 0
      signupState.guests = []
    }
    syncGuestLength(signupState, signupState.guest)
  }

  function adjustSignupCount(type, direction) {
    const max = type === 'self' ? 1 : isAdmin.value ? Infinity : 2
    signupState[type] = Math.max(0, Math.min(max, signupState[type] + direction))
    if (type === 'guest') syncGuestLength(signupState, signupState.guest)
  }

  return {
    signupState,
    showGuestValidation,
    selectedSeasonPlan,
    isSignupChanged,
    resetSignupState,
    adjustSignupCount,
  }
}
