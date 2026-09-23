import { nextTick, reactive, ref } from 'vue'
import { startLineOAuth } from '~/utils/lineOAuth'

export function useSignupDialogs({ liffStore, resetSignupState, signupState }) {
  const signupOpen = ref(false)
  const seasonCancelOpen = ref(false)
  const seasonPlanOpen = ref(false)
  const leaveConfirmOpen = ref(false)
  const heroCtaButton = ref(null)
  const signupSheetRef = ref(null)
  const successDialogButton = ref(null)
  const leaveConfirmButton = ref(null)
  const successDialog = reactive({
    open: false,
    title: '報名已送出',
    copy: '已送出報名 0 位，請稍候確認名單是否成功加入',
    buttonText: '確認',
    onButtonClick: null,
  })

  function focusElement(target) {
    nextTick(() => target.value?.focus?.({ preventScroll: true }))
  }

  function focusSignupClose() {
    nextTick(() => signupSheetRef.value?.focusClose?.())
  }

  function focusSignupConfirm() {
    nextTick(() => signupSheetRef.value?.focusConfirm?.())
  }

  function setSuccessDialogOpen(isOpen, options = {}) {
    if (options.title) successDialog.title = options.title
    if (options.copy) successDialog.copy = options.copy
    if (options.buttonText) successDialog.buttonText = options.buttonText
    successDialog.onButtonClick = options.onButtonClick ?? null
    successDialog.open = isOpen

    if (isOpen) focusElement(successDialogButton)
    else if (signupOpen.value) focusSignupConfirm()
    else focusElement(heroCtaButton)
  }

  function handleDialogButtonClick() {
    const callback = successDialog.onButtonClick
    setSuccessDialogOpen(false)
    if (callback) callback()
  }

  function setSignupOpen(isOpen, options = {}) {
    if (isOpen && !liffStore.userId) {
      if (liffStore.isExternalBrowser) startLineOAuth()
      else liffStore.login()
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
    successDialogButton,
    leaveConfirmButton,
    successDialog,
    focusElement,
    setSuccessDialogOpen,
    handleDialogButtonClick,
    setSignupOpen,
    openLeaveConfirm,
    cancelLeaveConfirm,
    confirmLeaveConfirm,
  }
}
