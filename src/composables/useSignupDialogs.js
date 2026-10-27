import { nextTick, ref } from 'vue'

export function useSignupDialogs({ identity, resetSignupState, signupState, feedback }) {
  const signupOpen = ref(false)
  const seasonCancelOpen = ref(false)
  const seasonPlanOpen = ref(false)
  const leaveConfirmOpen = ref(false)
  const heroCtaButton = ref(null)
  const signupSheetRef = ref(null)
  const leaveConfirmButton = ref(null)
  const focusElement = feedback.focusElement

  function focusSignupClose() {
    nextTick(() => signupSheetRef.value?.focusClose?.())
  }

  function focusSignupConfirm() {
    nextTick(() => signupSheetRef.value?.focusConfirm?.())
  }

  function setSuccessDialogOpen(isOpen, options = {}) {
    if (isOpen)
      feedback.show(options, () => {
        if (signupOpen.value) focusSignupConfirm()
        else focusElement(heroCtaButton)
      })
    else feedback.close()
  }

  function setSignupOpen(isOpen, options = {}) {
    if (isOpen && !identity.userId) {
      identity.login()
      return
    }

    const { restoreFocus = true } = options
    signupOpen.value = isOpen
    if (isOpen) {
      resetSignupState()
      focusSignupClose()
    } else if (restoreFocus) {
      focusElement(heroCtaButton)
    }
  }

  function openLeaveConfirm() {
    leaveConfirmOpen.value = true
    focusElement(leaveConfirmButton)
  }

  function cancelLeaveConfirm() {
    leaveConfirmOpen.value = false
    focusSignupConfirm()
  }

  function confirmLeaveConfirm() {
    leaveConfirmOpen.value = false
    signupState.self = 0
    focusSignupConfirm()
  }

  return {
    signupOpen,
    seasonCancelOpen,
    seasonPlanOpen,
    leaveConfirmOpen,
    heroCtaButton,
    signupSheetRef,
    leaveConfirmButton,
    focusElement,
    setSuccessDialogOpen,
    setSignupOpen,
    openLeaveConfirm,
    cancelLeaveConfirm,
    confirmLeaveConfirm,
  }
}
