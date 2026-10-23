import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActivityMemberLists } from '~/composables/useActivityMemberLists'
import { useActivityPageSnapshot } from '~/composables/useActivityPageSnapshot'
import { useActiveActivityViewModels } from '~/composables/useActiveActivityViewModels'
import { useRegistrationAdminActions } from '~/composables/useRegistrationAdminActions'
import { useSignupFlow } from '~/composables/useSignupFlow'
import { getActivityPage, getSeasonSignupPage } from '~/services/activityService'
import { removeRegistrationSubscription, subscribeToRegistrationChanges } from '~/services/registrationService'
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

  const viewModelsRef = shallowRef(null)
  const signupFlow = useSignupFlow({
    liffStore,
    activityData,
    activityType,
    resolvedDate,
    isAdmin,
    myRegistration,
    mySeasonRegistration,
    mySeasonRegistrations,
    fetchRegistrations: snapshot.refresh,
    nowTick,
    viewModels: viewModelsRef,
  })

  const viewModels = useActiveActivityViewModels({
    activityData,
    activityType,
    resolvedDate,
    signupOpen: signupFlow.signupOpen,
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
    isSubmitting: signupFlow.isSubmitting,
    adminMode,
    signupState: signupFlow.signupState,
    selectedSeasonPlan: signupFlow.selectedSeasonPlan,
  })
  viewModelsRef.value = viewModels

  const registrationAdminActions = useRegistrationAdminActions({
    liffStore,
    activityData,
    getActivityId: () => route.params.id,
    registrations,
    fetchRegistrations: snapshot.refresh,
    updatePayment: snapshot.updatePayment,
    applyAcUpdate: snapshot.updateAcEnabled,
    focusElement: signupFlow.focusElement,
    setSuccessDialogOpen: signupFlow.setSuccessDialogOpen,
  })

  function setSegmentTab(tab) {
    activeSegment.value = tab
  }

  function handleEscape() {
    if (signupFlow.seasonPlanOpen.value) signupFlow.seasonPlanOpen.value = false
    else if (signupFlow.seasonCancelOpen.value) signupFlow.seasonCancelOpen.value = false
    else if (registrationAdminActions.removeDialog.open) registrationAdminActions.cancelRemove()
    else if (signupFlow.leaveConfirmOpen.value) signupFlow.cancelLeaveConfirm()
    else if (signupFlow.successDialog.open) signupFlow.setSuccessDialogOpen(false)
    else if (signupFlow.signupOpen.value) signupFlow.setSignupOpen(false)
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
    signupOpen: signupFlow.signupOpen,
    isSubmitting: signupFlow.isSubmitting,
    showGuestValidation: signupFlow.showGuestValidation,
    signupState: signupFlow.signupState,
    guestLimit: signupFlow.guestLimit,
    signupTotal: computed(() => viewModels.signup.signupTotal),
    isSignupChanged: signupFlow.isSignupChanged,
    isRegistrationOpen: computed(() => viewModels.signup.isRegistrationOpen),
    registrationCountdown: computed(() => viewModels.signup.registrationCountdown),
    isSeasonLeaveMode: computed(() => viewModels.signup.isSeasonLeaveMode),
    showFooterCta: computed(() => viewModels.signup.showFooterCta),
    ctaDisabled: computed(() => viewModels.signup.ctaDisabled),
    ctaLabel: computed(() => viewModels.signup.ctaLabel),
  })

  const dialogs = reactive({
    showAllDatesDialog,
    successDialog: signupFlow.successDialog,
    removeDialog: registrationAdminActions.removeDialog,
    leaveConfirmOpen: signupFlow.leaveConfirmOpen,
    seasonCancelOpen: signupFlow.seasonCancelOpen,
    seasonCancelPlanLabel: signupFlow.seasonCancelPlanLabel,
    seasonPlanOpen: signupFlow.seasonPlanOpen,
    seasonPlanOptions: viewModels.seasonPlanOptions,
    isSeasonPlanManageMode: computed(() => viewModels.hasSubmittedSignup.value),
  })

  const admin = reactive({
    adminMode,
    isAdmin,
    acEnabled,
    acFeePerSession,
  })

  const elementRefs = {
    heroCtaButton: signupFlow.heroCtaButton,
    signupSheetRef: signupFlow.signupSheetRef,
    successDialogButton: signupFlow.successDialogButton,
    removeConfirmButton: registrationAdminActions.removeConfirmButton,
    leaveConfirmButton: signupFlow.leaveConfirmButton,
  }

  const actions = {
    setSignupOpen: signupFlow.setSignupOpen,
    handleDialogButtonClick: signupFlow.handleDialogButtonClick,
    setSegmentTab,
    adjustSignupCount: signupFlow.adjustSignupCount,
    submitSignup: signupFlow.submitSignup,
    togglePayment: registrationAdminActions.togglePayment,
    handleRemoveRequest: registrationAdminActions.handleRemoveRequest,
    cancelRemove: registrationAdminActions.cancelRemove,
    confirmRemove: registrationAdminActions.confirmRemove,
    cancelLeaveConfirm: signupFlow.cancelLeaveConfirm,
    confirmLeaveConfirm: signupFlow.confirmLeaveConfirm,
    updateAcEnabled: registrationAdminActions.updateAcEnabled,
    loadActivityPage,
    retryRefresh,
    handleCtaClick: signupFlow.handleCtaClick,
    handleSeasonPlanConfirm: signupFlow.handleSeasonPlanConfirm,
    confirmSeasonCancel: signupFlow.confirmSeasonCancel,
    closeSuccessDialog: () => signupFlow.setSuccessDialogOpen(false),
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
