import { ref } from 'vue'
import { invokeRegistrationAction } from '~/services/registrationService'
import { startLineOAuth } from '~/utils/lineOAuth'

function formatRegistrationOpenTime(viewModels) {
  return viewModels.registrationOpenAt.value ? viewModels.registrationOpenAt.value.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' }) : '—'
}

export function useSignupSubmission({
  liffStore,
  activityData,
  activityType,
  resolvedDate,
  myRegistration,
  mySeasonRegistration,
  fetchRegistrations,
  viewModels,
  signupState,
  showGuestValidation,
  selectedSeasonPlan,
  isSignupChanged,
  setSuccessDialogOpen,
  setSignupOpen,
  seasonCancelOpen,
  seasonPlanOpen,
}) {
  const isSubmitting = ref(false)

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
      const openTime = formatRegistrationOpenTime(currentViewModels)
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
      const openTime = formatRegistrationOpenTime(viewModels.value)
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
    isSubmitting,
    submitSignup,
    handleCtaClick,
    handleSeasonPlanConfirm,
    confirmSeasonCancel,
  }
}
