import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActivityMemberLists } from '~/composables/useActivityMemberLists'
import { useActivityPageSnapshot } from '~/composables/useActivityPageSnapshot'
import { useActiveActivityViewModels } from '~/composables/useActiveActivityViewModels'
import { useRegistrationAdminActions } from '~/composables/useRegistrationAdminActions'
import { useSignupInteraction } from '~/composables/useSignupInteraction'
import { usePageFeedback } from '~/composables/usePageFeedback'
import { getActivityPage, getSeasonSignupPage } from '~/services/activityService'
import { invokeRegistrationAction, removeRegistrationSubscription, subscribeToRegistrationChanges } from '~/services/registrationService'
import { useLiffStore } from '~/stores/liff'
import { getTaiwanDateString, parseTaiwanDateTime } from '~/utils/taiwanDate'

const SESSION_ENDED_GRACE_MS = 60 * 60 * 1000

export function useActiveActivityPage() {
  const route = useRoute()
  const router = useRouter()
  const liffStore = useLiffStore()

  const snapshot = useActivityPageSnapshot({
    liffStore,
    loadPage: (id, dateId, season) => (season ? getSeasonSignupPage(id) : getActivityPage(id, dateId)),
    subscribe: subscribeToRegistrationChanges,
    unsubscribe: removeRegistrationSubscription,
  })
  const {
    activityData,
    activityLoadState,
    registrations,
    cancelledRegistrations,
    seasonRegistrations,
    myRegistration,
    mySeasonRegistration,
    mySeasonRegistrations,
    memberGenders,
    acEnabled,
    acFeePerSession,
  } = snapshot
  const activityNotFound = computed(() => activityLoadState.value === 'not-found')
  const isLoading = computed(() => activityLoadState.value === 'loading')
  const showAllDatesDialog = ref(false)
  const activeSegment = ref('臨打')
  const adminMode = ref(false)
  const nowTick = ref(new Date())

  const isSeasonSignupPage = computed(() => route.meta.activityPageMode === 'season')
  const resolvedDate = snapshot.resolvedDate
  // 與 list_activities 的「已結束」同一組規則：結束時間過後一小時才算結束。
  // LINE 通知卡片等外部連結不會帶 type，所以不能只靠 query 判斷，否則過期球局仍會顯示報名 CTA。
  const isSessionEnded = computed(() => {
    if (isSeasonSignupPage.value || !resolvedDate.value) return false
    const endTime = activityData.value?.end_time
    if (!endTime) return resolvedDate.value < getTaiwanDateString(nowTick.value)
    return nowTick.value.getTime() > parseTaiwanDateTime(resolvedDate.value, endTime).getTime() + SESSION_ENDED_GRACE_MS
  })
  const activityType = computed(() => {
    if (isSeasonSignupPage.value) return 'season'
    if (isSessionEnded.value) return 'ended'
    if (route.query.type) return route.query.type
    // 外部連結在資料載入前無法判斷場次是否已結束，先用中性樣式，避免閃過最新球局再跳成已結束。
    return activityData.value ? 'latest' : 'pending'
  })
  const isAdmin = computed(() => liffStore.role === 'organizer')

  const { memberList, cancelledMemberList, leaveMemberList } = useActivityMemberLists({
    activityData,
    activityType,
    resolvedDate,
    registrations,
    cancelledRegistrations,
    seasonRegistrations,
    memberGenders,
  })

  const feedback = usePageFeedback()
  const signupInteraction = useSignupInteraction({
    identity: liffStore,
    snapshot,
    activityType,
    isAdmin,
    nowTick,
    isLoading,
    adminMode,
    feedback,
    writeRegistration: body => invokeRegistrationAction(liffStore, body),
  })

  const viewModels = useActiveActivityViewModels({
    activityData,
    activityType,
    resolvedDate,
    signupInteraction,
    acEnabled,
    acFeePerSession,
    nowTick,
    memberList,
    cancelledMemberList,
    leaveMemberList,
    myRegistration,
    mySeasonRegistration,
    mySeasonRegistrations,
    activeSegment,
    isLoading,
  })

  const registrationAdminActions = useRegistrationAdminActions({
    liffStore,
    activityData,
    getActivityId: () => route.params.id,
    registrations,
    fetchRegistrations: snapshot.refresh,
    updatePayment: snapshot.updatePayment,
    applyAcUpdate: snapshot.updateAcEnabled,
    focusElement: feedback.focusElement,
    setSuccessDialogOpen: (isOpen, options) => {
      if (isOpen) feedback.show(options, () => feedback.focusElement(signupInteraction.heroCtaButton))
      else feedback.close()
    },
  })

  function setSegmentTab(tab) {
    activeSegment.value = tab
  }

  function handleEscape() {
    if (signupInteraction.seasonPlanOpen.value) signupInteraction.seasonPlanOpen.value = false
    else if (signupInteraction.seasonCancelOpen.value) signupInteraction.seasonCancelOpen.value = false
    else if (registrationAdminActions.removeDialog.open) registrationAdminActions.cancelRemove()
    else if (signupInteraction.leaveConfirmOpen.value) signupInteraction.cancelLeaveConfirm()
    else if (feedback.dialog.open) feedback.close()
    else if (signupInteraction.signupOpen.value) signupInteraction.setSignupOpen(false)
  }

  let nowTickInterval = null
  let stopRouteWatch = null
  async function loadActivityPage() {
    if (nowTickInterval) clearInterval(nowTickInterval)
    nowTickInterval = null
    try {
      const loaded = await snapshot.open({
        id: route.params.id,
        dateId: typeof route.params.activityDateId === 'string' ? route.params.activityDateId : null,
        season: isSeasonSignupPage.value,
      })
      if (!loaded) return
      nowTickInterval = setInterval(() => {
        nowTick.value = new Date()
      }, 1000)
    } catch {
      // The snapshot exposes its load error state to the page.
    }
  }

  async function retryRefresh() {
    try {
      await snapshot.refresh()
    } catch {
      // The stale notice remains visible until a refresh succeeds.
    }
  }

  onMounted(() => {
    loadActivityPage()
    stopRouteWatch = watch(() => [route.params.id, route.params.activityDateId, isSeasonSignupPage.value], loadActivityPage)
  })

  onUnmounted(() => {
    if (stopRouteWatch) stopRouteWatch()
    if (nowTickInterval) clearInterval(nowTickInterval)
    snapshot.dispose()
  })

  const navigation = { router }

  const activity = reactive({
    activityData,
    activityLoadState,
    activityNotFound,
    activityType,
    isStale: snapshot.isStale,
    pageClasses: computed(() => viewModels.activity.pageClasses),
    showHeroCat: computed(() => viewModels.activity.showHeroCat),
    heroTitle: computed(() => viewModels.activity.heroTitle),
    isLoading,
  })

  const signup = reactive({
    signupOpen: signupInteraction.signupOpen,
    isSubmitting: signupInteraction.isSubmitting,
    showGuestValidation: signupInteraction.showGuestValidation,
    signupState: signupInteraction.signupState,
    guestLimit: signupInteraction.guestLimit,
    signupTotal: signupInteraction.signupTotal,
    isSignupChanged: signupInteraction.isSignupChanged,
    isRegistrationOpen: signupInteraction.isRegistrationOpen,
    registrationCountdown: signupInteraction.registrationCountdown,
    isSeasonLeaveMode: signupInteraction.isSeasonLeaveMode,
    showFooterCta: signupInteraction.showFooterCta,
    ctaDisabled: signupInteraction.ctaDisabled,
    ctaLabel: signupInteraction.ctaLabel,
  })

  const dialogs = reactive({
    showAllDatesDialog,
    successDialog: feedback.dialog,
    removeDialog: registrationAdminActions.removeDialog,
    leaveConfirmOpen: signupInteraction.leaveConfirmOpen,
    seasonCancelOpen: signupInteraction.seasonCancelOpen,
    seasonCancelPlanLabel: signupInteraction.seasonCancelPlanLabel,
    seasonPlanOpen: signupInteraction.seasonPlanOpen,
    seasonPlanOptions: signupInteraction.availableSeasonPlans,
    isSeasonPlanManageMode: signupInteraction.hasSubmittedSignup,
  })

  const admin = reactive({
    adminMode,
    isAdmin,
    acEnabled,
    acFeePerSession,
  })

  const elementRefs = {
    heroCtaButton: signupInteraction.heroCtaButton,
    signupSheetRef: signupInteraction.signupSheetRef,
    successDialogButton: feedback.buttonRef,
    removeConfirmButton: registrationAdminActions.removeConfirmButton,
    leaveConfirmButton: signupInteraction.leaveConfirmButton,
  }

  const actions = {
    setSignupOpen: signupInteraction.setSignupOpen,
    handleDialogButtonClick: feedback.handleButtonClick,
    setSegmentTab,
    adjustSignupCount: signupInteraction.adjustSignupCount,
    submitSignup: signupInteraction.submitSignup,
    togglePayment: registrationAdminActions.togglePayment,
    handleRemoveRequest: registrationAdminActions.handleRemoveRequest,
    cancelRemove: registrationAdminActions.cancelRemove,
    confirmRemove: registrationAdminActions.confirmRemove,
    cancelLeaveConfirm: signupInteraction.cancelLeaveConfirm,
    confirmLeaveConfirm: signupInteraction.confirmLeaveConfirm,
    updateAcEnabled: registrationAdminActions.updateAcEnabled,
    loadActivityPage,
    retryRefresh,
    handleCtaClick: signupInteraction.handleCtaClick,
    handleSeasonPlanConfirm: signupInteraction.handleSeasonPlanConfirm,
    confirmSeasonCancel: signupInteraction.confirmSeasonCancel,
    closeSuccessDialog: feedback.close,
    handleEscape,
  }

  return {
    navigation,
    activity,
    summary: viewModels.summary,
    members: viewModels.members,
    signup,
    dialogs,
    admin,
    elementRefs,
    actions,
  }
}
