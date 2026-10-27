import { computed } from 'vue'
import { useSeasonPlanData } from './useSeasonPlanData.js'
import { useSignupDialogs } from './useSignupDialogs.js'
import { useSignupFormState } from './useSignupFormState.js'
import { useSignupSubmission } from './useSignupSubmission.js'
import { addTaiwanDays, parseTaiwanDateTime } from '~/utils/taiwanDate'
import { normalizeSeasonPlan, SEASON_PLAN_HALF_YEAR, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_QUARTER } from '~/utils/seasonPlan'

const SEASON_PLAN_ORDER = [SEASON_PLAN_QUARTER, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_HALF_YEAR]

// The page snapshot owns reads and refresh ordering. This module owns one member's
// signup decisions and interaction, including form state, dialogs, and write results.
export function useSignupInteraction({ identity, snapshot, activityType, isAdmin, nowTick, isLoading, adminMode, feedback, writeRegistration }) {
  const { activityData, resolvedDate, myRegistration, mySeasonRegistration, mySeasonRegistrations } = snapshot

  const mySeasonPlans = computed(() => {
    if (activityType.value !== 'season') return []
    const plans = new Set((mySeasonRegistrations.value || []).map(registration => normalizeSeasonPlan(registration.season_plan)))
    return SEASON_PLAN_ORDER.filter(plan => plans.has(plan))
  })
  const seasonPlans = useSeasonPlanData(activityData, mySeasonPlans, nowTick)
  const availableSeasonPlans = computed(() => (activityType.value === 'season' ? seasonPlans.value.filter(plan => plan.available) : []))
  const selectableSeasonPlans = computed(() => availableSeasonPlans.value.filter(plan => plan.selectable))
  const registrationOpenAt = computed(() => {
    const activity = activityData.value
    if (!activity) return null
    if (activityType.value === 'season') {
      if (selectableSeasonPlans.value.length) return null
      const pending = availableSeasonPlans.value.map(plan => plan.openAt).filter(openAt => openAt && nowTick.value < openAt)
      return pending.length ? new Date(Math.min(...pending.map(openAt => openAt.getTime()))) : null
    }
    if (!resolvedDate.value || activity.pickup_open_days_before == null || !activity.pickup_open_time) return null
    return parseTaiwanDateTime(addTaiwanDays(resolvedDate.value, -activity.pickup_open_days_before), activity.pickup_open_time)
  })
  const registrationCloseAt = computed(() => {
    if (activityType.value !== 'season') return null
    const closeTimes = availableSeasonPlans.value.map(plan => plan.closeAt)
    if (!closeTimes.length || closeTimes.some(closeAt => !closeAt)) return null
    return new Date(Math.max(...closeTimes.map(closeAt => closeAt.getTime())))
  })
  const isSeasonRegistrationClosed = computed(() => (registrationCloseAt.value ? nowTick.value >= registrationCloseAt.value : false))
  const isSeasonLeaveMode = computed(() => activityType.value !== 'season' && !!mySeasonRegistration.value)
  const isRegistrationOpen = computed(() => (registrationOpenAt.value ? nowTick.value >= registrationOpenAt.value : true))
  const registrationCountdown = computed(() => {
    if (isRegistrationOpen.value || !registrationOpenAt.value) return null
    const diff = registrationOpenAt.value.getTime() - nowTick.value.getTime()
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} 後開放` : `${minutes}:${String(seconds).padStart(2, '0')} 後開放`
  })
  const submittedTotal = computed(() => {
    if (!myRegistration.value) return 0
    return (myRegistration.value.is_self_registration && !myRegistration.value.cancelled_at ? 1 : 0) + (myRegistration.value.guests || []).filter(guest => !guest.cancelled_at).length
  })
  const hasSubmittedSignup = computed(() => {
    if (activityType.value === 'season') return submittedTotal.value > 0
    if (submittedTotal.value > 0) return true
    if (!isSeasonLeaveMode.value) return false
    return !(mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value)
  })

  const formState = useSignupFormState({ isAdmin, activityData, myRegistration, mySeasonRegistration, resolvedDate, nowTick, isSeasonLeaveMode })
  const signupTotal = computed(() => formState.signupState.self + formState.signupState.guest)
  const decisions = { isSeasonLeaveMode, isRegistrationOpen, registrationOpenAt, signupTotal, submittedTotal, isSeasonRegistrationClosed, hasSubmittedSignup, selectableSeasonPlans }
  const dialogs = useSignupDialogs({ identity, resetSignupState: formState.resetSignupState, signupState: formState.signupState, feedback })
  const submission = useSignupSubmission({
    identity,
    activityData,
    activityType,
    resolvedDate,
    myRegistration,
    mySeasonRegistration,
    mySeasonRegistrations,
    refreshSnapshot: snapshot.refresh,
    decisions,
    writeRegistration,
    signupState: formState.signupState,
    showGuestValidation: formState.showGuestValidation,
    selectedSeasonPlan: formState.selectedSeasonPlan,
    isSignupChanged: formState.isSignupChanged,
    setSuccessDialogOpen: dialogs.setSuccessDialogOpen,
    setSignupOpen: dialogs.setSignupOpen,
    seasonCancelOpen: dialogs.seasonCancelOpen,
    seasonPlanOpen: dialogs.seasonPlanOpen,
  })
  const showFooterCta = computed(() => !isLoading.value && activityType.value !== 'ended' && !adminMode.value)
  const ctaDisabled = computed(() => isSeasonRegistrationClosed.value && !hasSubmittedSignup.value)
  const ctaLabel = computed(() => {
    if (submission.isSubmitting.value) return '處理中...'
    if (activityType.value === 'season') {
      if (ctaDisabled.value) return '已截止報名'
      return submittedTotal.value > 0 ? '管理報名' : '我要報名'
    }
    return isSeasonLeaveMode.value || hasSubmittedSignup.value ? '管理報名' : '我要報名'
  })

  function adjustSignupCount(type, direction) {
    if (type === 'self' && direction === -1 && isSeasonLeaveMode.value && formState.signupState.self === 1) {
      dialogs.openLeaveConfirm()
      return
    }
    formState.adjustSignupCount(type, direction)
  }

  return {
    signupOpen: dialogs.signupOpen,
    isSubmitting: submission.isSubmitting,
    showGuestValidation: formState.showGuestValidation,
    signupState: formState.signupState,
    guestLimit: formState.guestLimit,
    isSignupChanged: formState.isSignupChanged,
    selectedSeasonPlan: formState.selectedSeasonPlan,
    seasonCancelOpen: dialogs.seasonCancelOpen,
    seasonPlanOpen: dialogs.seasonPlanOpen,
    leaveConfirmOpen: dialogs.leaveConfirmOpen,
    heroCtaButton: dialogs.heroCtaButton,
    signupSheetRef: dialogs.signupSheetRef,
    leaveConfirmButton: dialogs.leaveConfirmButton,
    setSignupOpen: dialogs.setSignupOpen,
    cancelLeaveConfirm: dialogs.cancelLeaveConfirm,
    confirmLeaveConfirm: dialogs.confirmLeaveConfirm,
    submitSignup: submission.submitSignup,
    handleCtaClick: submission.handleCtaClick,
    handleSeasonPlanConfirm: submission.handleSeasonPlanConfirm,
    confirmSeasonCancel: submission.confirmSeasonCancel,
    seasonCancelPlanLabel: submission.seasonCancelPlanLabel,
    adjustSignupCount,
    mySeasonPlans,
    seasonPlans,
    availableSeasonPlans,
    selectableSeasonPlans,
    registrationOpenAt,
    isSeasonRegistrationClosed,
    isSeasonLeaveMode,
    isRegistrationOpen,
    registrationCountdown,
    submittedTotal,
    hasSubmittedSignup,
    signupTotal,
    showFooterCta,
    ctaDisabled,
    ctaLabel,
  }
}
