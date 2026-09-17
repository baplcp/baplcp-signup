import { computed, nextTick, reactive, ref, watch } from 'vue'
import { invokeRegistrationAction } from '~/services/registrationService'
import { startLineOAuth } from '~/utils/lineOAuth'

function toGuestForm(guests = []) {
  return guests.map(guest => ({ name: guest.name || '', gender: guest.gender || '', added_at: guest.added_at || null }))
}

function syncGuestLength(signupState, count) {
  while (signupState.guests.length < count) signupState.guests.push({ name: '', gender: '', added_at: new Date().toISOString() })
  signupState.guests.splice(count)
}

export function useSignupFlow({ liffStore, activityData, activityType, resolvedDate, isAdmin, myRegistration, mySeasonRegistration, fetchRegistrations, viewModels }) {
  const signupOpen = ref(false)
  const isSubmitting = ref(false)
  const showGuestValidation = ref(false)
  const seasonCancelOpen = ref(false)
  const seasonPlanOpen = ref(false)
  const selectedSeasonPlan = ref('quarter')
  const heroCtaButton = ref(null)
  const signupSheetRef = ref(null)
  const successDialogButton = ref(null)
  const leaveConfirmButton = ref(null)
  const signupState = reactive({ self: 0, guest: 0, guests: [] })
  const successDialog = reactive({
    open: false,
    title: '報名已送出',
    copy: '已送出報名 0 位，請稍候確認名單是否成功加入',
    buttonText: '確認',
    onButtonClick: null,
  })
  const leaveConfirmOpen = ref(false)

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
    } else if (signupState.self !== (myRegistration.value?.self_count ?? 0)) {
      return true
    }

    const previousGuests = myRegistration.value?.guests ?? []
    if (signupState.guest !== (myRegistration.value?.guest_count ?? 0)) return true
    for (let index = 0; index < signupState.guest; index += 1) {
      const current = signupState.guests[index] || { name: '', gender: '' }
      const previous = previousGuests[index] || { name: '', gender: '' }
      if ((current.name || '') !== (previous.name || '') || (current.gender || '') !== (previous.gender || '')) return true
    }
    return false
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
      showGuestValidation.value = false
      if (viewModels.value.isSeasonLeaveMode.value) {
        const isOnLeave = (mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value)
        signupState.self = isOnLeave ? 0 : 1
        signupState.guest = myRegistration.value?.guest_count || 0
        signupState.guests = toGuestForm(myRegistration.value?.guests)
      } else if (myRegistration.value) {
        signupState.self = myRegistration.value.self_count || 0
        signupState.guest = myRegistration.value.guest_count || 0
        signupState.guests = toGuestForm(myRegistration.value.guests)
      } else {
        signupState.self = 0
        signupState.guest = 0
        signupState.guests = []
      }
      syncGuestLength(signupState, signupState.guest)
      focusSignupClose()
    } else if (restoreFocus) {
      focusElement(heroCtaButton)
    }
  }

  function adjustSignupCount(type, direction) {
    if (type === 'self' && direction === -1 && viewModels.value.isSeasonLeaveMode.value && signupState.self === 1) {
      leaveConfirmOpen.value = true
      focusElement(leaveConfirmButton)
      return
    }
    const max = type === 'self' ? 1 : isAdmin.value ? Infinity : 6
    signupState[type] = Math.max(0, Math.min(max, signupState[type] + direction))
    if (type === 'guest') syncGuestLength(signupState, signupState.guest)
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

  async function submitSignup() {
    if (isSubmitting.value) return
    isSubmitting.value = true
    try {
      await doSubmitSignup()
    } finally {
      isSubmitting.value = false
    }
  }

  async function doSubmitSignup() {
    await liffStore.initialize()
    if (!liffStore.userId) {
      setSuccessDialogOpen(true, {
        title: '請先登入',
        copy: liffStore.isExternalBrowser ? '需要以 LINE 帳號登入才能送出報名，點擊下方按鈕前往 LINE 登入。' : '需要以 LINE 帳號登入才能送出報名，點擊下方按鈕前往登入。',
        buttonText: liffStore.isExternalBrowser ? '以 LINE 登入' : '前往 LINE 登入',
        onButtonClick: () => (liffStore.isExternalBrowser ? startLineOAuth() : liffStore.login()),
      })
      return
    }

    const currentViewModels = viewModels.value
    const isPureSeasonLeave = currentViewModels.isSeasonLeaveMode.value && signupState.guest === 0
    if (!currentViewModels.isRegistrationOpen.value && !isPureSeasonLeave) {
      const openTime = currentViewModels.registrationOpenAt.value
        ? currentViewModels.registrationOpenAt.value.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' })
        : '—'
      setSuccessDialogOpen(true, { title: '報名尚未開放', copy: `報名將於 ${openTime} 開放，你可以先填好資料，時間到再送出。`, buttonText: '知道了' })
      return
    }

    const missingGender = signupState.guests.slice(0, signupState.guest).some(guest => !guest.gender)
    if (missingGender) {
      showGuestValidation.value = true
      setSuccessDialogOpen(true, { title: '請選擇性別', copy: '每位群外朋友都需要選擇性別，請補齊後再送出。', buttonText: '回去填寫' })
      return
    }

    if (currentViewModels.isSeasonLeaveMode.value) {
      const seasonRegistration = mySeasonRegistration.value
      const isCurrentlyOnLeave = (seasonRegistration?.leave_dates || []).includes(resolvedDate.value)
      const newSelf = signupState.self
      const leaveStatusChanged = (newSelf === 0) !== isCurrentlyOnLeave
      const guestTotal = signupState.guest
      try {
        await invokeRegistrationAction(liffStore, {
          action: 'season-leave',
          activityId: activityData.value?.id,
          activityDate: resolvedDate.value,
          selfCount: newSelf,
          guestCount: guestTotal,
          guests: signupState.guests.slice(0, guestTotal),
        })
        await fetchRegistrations()
        setSignupOpen(false, { restoreFocus: false })
        const title = leaveStatusChanged && guestTotal === 0 ? (newSelf === 0 ? '已請假' : '已取消請假') : '已更新'
        const copy = leaveStatusChanged && guestTotal === 0 ? (newSelf === 0 ? '已為此場次請假，名額將釋出給臨打。' : '已取消請假，你將重新加入此場次名單。') : '出席狀態與群外報名已更新。'
        setSuccessDialogOpen(true, { title, copy, buttonText: '確認' })
      } catch {
        setSuccessDialogOpen(true, { title: '操作失敗', copy: '請稍後再試。', buttonText: '確認' })
      }
      return
    }

    if (!isSignupChanged.value) return
    const total = currentViewModels.signupTotal.value
    const previousTotal = currentViewModels.submittedTotal.value
    const isUpdatingExistingSignup = previousTotal > 0
    if (total <= 0 && previousTotal <= 0) {
      setSuccessDialogOpen(true, { title: '還沒有選擇人數', copy: '目前沒有任何人被加入報名，請先選擇「我」或「群外」人數後再送出。', buttonText: '回去選人' })
      return
    }

    try {
      await invokeRegistrationAction(liffStore, {
        action: 'save-registration',
        activityId: activityData.value?.id,
        activityDate: activityType.value === 'season' ? null : resolvedDate.value,
        selfCount: total <= 0 ? 0 : signupState.self,
        guestCount: total <= 0 ? 0 : signupState.guest,
        guests: total <= 0 ? [] : signupState.guests.slice(0, signupState.guest),
      })
      await fetchRegistrations()
      setSignupOpen(false, { restoreFocus: false })
      setSuccessDialogOpen(true, {
        title: total <= 0 ? '報名已取消' : isUpdatingExistingSignup ? '報名已更新' : '報名已送出',
        copy: total <= 0 ? '已取消報名，名單將同步更新。' : `${isUpdatingExistingSignup ? '已更新報名 ' : '已送出報名 '}${total} 位，請稍候確認名單是否成功加入`,
        buttonText: '確認',
      })
    } catch {
      setSuccessDialogOpen(true, { title: total <= 0 ? '取消失敗' : '報名失敗', copy: total <= 0 ? '取消時發生錯誤，請稍後再試。' : '送出時發生錯誤，請稍後再試。', buttonText: '確認' })
    }
  }

  function monthRange(dates) {
    if (!dates.length) return ''
    const first = new Date(dates[0])
    const last = new Date(dates[dates.length - 1])
    const firstMonth = `${first.getMonth() + 1}月`
    const lastMonth = `${last.getMonth() + 1}月`
    return firstMonth === lastMonth ? firstMonth : `${first.getMonth() + 1}-${last.getMonth() + 1}月`
  }

  const seasonPlanData = computed(() => {
    const dates = [...(activityData.value?.dates || [])].sort()
    if (!dates.length) return { quarterCount: 0, quarterDateRange: '', quarterTotal: 0, quarterFeePerSession: 0, halfYearCount: 0, halfYearDateRange: '', halfYearTotal: 0, halfYearFeePerSession: 0 }
    const first = new Date(dates[0])
    const cutoff = new Date(first.getFullYear(), first.getMonth() + 3, 1)
    const quarterDates = dates.filter(date => new Date(date) < cutoff)
    return {
      quarterCount: quarterDates.length,
      quarterDateRange: monthRange(quarterDates),
      quarterTotal: activityData.value?.season_total_fee || 0,
      quarterFeePerSession: activityData.value?.season_fee_per_session || 0,
      halfYearCount: dates.length,
      halfYearDateRange: monthRange(dates),
      halfYearTotal: activityData.value?.season_half_year_total_fee || 0,
      halfYearFeePerSession: activityData.value?.season_half_year_fee_per_session || 0,
    }
  })

  async function handleCtaClick() {
    const currentViewModels = viewModels.value
    if (activityType.value !== 'season') {
      setSignupOpen(true)
      return
    }
    if (currentViewModels.isSeasonRegistrationClosed.value && !currentViewModels.hasSubmittedSignup.value) return
    if (currentViewModels.hasSubmittedSignup.value) {
      if (currentViewModels.isSeasonRegistrationClosed.value) {
        setSuccessDialogOpen(true, { title: '已超過截止時間', copy: '若需取消季打報名，請直接聯繫主揪處理。', buttonText: '知道了' })
        return
      }
      seasonCancelOpen.value = true
      return
    }
    seasonPlanOpen.value = true
  }

  async function handleSeasonPlanConfirm(plan) {
    selectedSeasonPlan.value = plan || 'quarter'
    seasonPlanOpen.value = false
    await directSeasonRegister()
  }

  async function directSeasonRegister() {
    await liffStore.initialize()
    if (!liffStore.userId) {
      if (liffStore.isExternalBrowser) startLineOAuth()
      else liffStore.login()
      return
    }
    if (!viewModels.value.isRegistrationOpen.value) {
      const openTime = viewModels.value.registrationOpenAt.value
        ? viewModels.value.registrationOpenAt.value.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' })
        : '—'
      setSuccessDialogOpen(true, { title: '報名尚未開放', copy: `季打報名將於 ${openTime} 開放。`, buttonText: '知道了' })
      return
    }
    if (isSubmitting.value) return
    isSubmitting.value = true
    try {
      await invokeRegistrationAction(liffStore, { action: 'direct-season-register', activityId: activityData.value?.id, seasonPlan: selectedSeasonPlan.value })
      liffStore.isSeason = true
      await fetchRegistrations()
    } catch {
      setSuccessDialogOpen(true, { title: '報名失敗', copy: '送出時發生錯誤，請稍後再試。', buttonText: '確認' })
    } finally {
      isSubmitting.value = false
    }
  }

  async function confirmSeasonCancel() {
    seasonCancelOpen.value = false
    if (!myRegistration.value) return
    try {
      await invokeRegistrationAction(liffStore, { action: 'season-cancel', activityId: activityData.value?.id })
      liffStore.isSeason = false
      await fetchRegistrations()
    } catch {
      setSuccessDialogOpen(true, { title: '取消失敗', copy: '請稍後再試。', buttonText: '確認' })
    }
  }

  return {
    signupOpen,
    isSubmitting,
    showGuestValidation,
    seasonCancelOpen,
    seasonPlanOpen,
    selectedSeasonPlan,
    signupState,
    successDialog,
    leaveConfirmOpen,
    isSignupChanged,
    seasonPlanData,
    heroCtaButton,
    signupSheetRef,
    successDialogButton,
    leaveConfirmButton,
    focusElement,
    setSuccessDialogOpen,
    handleDialogButtonClick,
    setSignupOpen,
    adjustSignupCount,
    cancelLeaveConfirm,
    confirmLeaveConfirm,
    submitSignup,
    handleCtaClick,
    handleSeasonPlanConfirm,
    confirmSeasonCancel,
  }
}
