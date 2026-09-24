import { computed, onMounted, onUnmounted, reactive, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActivityMemberLists } from '~/composables/useActivityMemberLists'
import { useActiveActivityRegistrations } from '~/composables/useActiveActivityRegistrations'
import { useActiveActivityViewModels } from '~/composables/useActiveActivityViewModels'
import { useRegistrationAdminActions } from '~/composables/useRegistrationAdminActions'
import { useSignupFlow } from '~/composables/useSignupFlow'
import { getActivityPage, getSeasonSignupPage } from '~/services/activityService'
import { removeRegistrationSubscription, subscribeToRegistrationChanges } from '~/services/registrationService'
import { useLiffStore } from '~/stores/liff'
import { getTaiwanDateString } from '~/utils/taiwanDate'

export function useActiveActivityPage() {
  const route = useRoute()
  const router = useRouter()
  const liffStore = useLiffStore()

  const activityData = ref(null)
  const activityLoadState = ref('loading')
  const activityNotFound = computed(() => activityLoadState.value === 'not-found')
  const isLoading = computed(() => activityLoadState.value === 'loading')
  const acEnabled = ref(false)
  const acFeePerSession = ref(0)
  const showAllDatesDialog = ref(false)
  const activeSegment = ref('臨打')
  const adminMode = ref(false)
  const nowTick = ref(new Date())

  const isSeasonSignupPage = computed(() => route.meta.activityPageMode === 'season')
  const activityType = computed(() => (isSeasonSignupPage.value ? 'season' : route.query.type || 'latest'))
  const resolvedDate = computed(() => {
    if (activityData.value?.selected_activity_date) return activityData.value.selected_activity_date
    if (!activityData.value?.dates) return null
    const today = getTaiwanDateString()
    const sorted = activityData.value.dates.slice().sort()
    return sorted.find(date => date >= today) || sorted[sorted.length - 1] || null
  })
  const isAdmin = computed(() => liffStore.role === 'organizer')

  const { registrations, cancelledRegistrations, seasonRegistrations, myRegistration, mySeasonRegistration, memberGenders, fetchRegistrations } = useActiveActivityRegistrations({
    activityData,
    activityType,
    resolvedDate,
    getActivityId: () => route.params.id,
    liffStore,
    loadActivityPage: (activityId, activityDateId) => (isSeasonSignupPage.value ? getSeasonSignupPage(activityId) : getActivityPage(activityId, activityDateId)),
  })

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
    fetchRegistrations,
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
    seasonRegistrations,
    acEnabled,
    fetchRegistrations,
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
  let realtimeChannel = null
  let registrationRefreshTimer = null
  let registrationRefreshInFlight = false
  async function flushRegistrationChanges() {
    if (registrationRefreshInFlight) return

    registrationRefreshInFlight = true
    try {
      await fetchRegistrations()
    } catch (error) {
      console.warn('Unable to refresh activity registration', error)
    } finally {
      registrationRefreshInFlight = false
    }
  }

  function scheduleRegistrationRefresh() {
    if (registrationRefreshTimer) clearTimeout(registrationRefreshTimer)
    registrationRefreshTimer = setTimeout(() => {
      registrationRefreshTimer = null
      flushRegistrationChanges()
    }, 750)
  }

  async function loadActivityPage() {
    activityLoadState.value = 'loading'
    activityData.value = null

    const id = route.params.id
    const requestedActivityDateId = typeof route.params.activityDateId === 'string' ? route.params.activityDateId : null
    const activityPagePromise = isSeasonSignupPage.value ? getSeasonSignupPage(id) : getActivityPage(id, requestedActivityDateId)
    try {
      await liffStore.initialize()
      const activityPage = await activityPagePromise
      if (!activityPage?.activity) {
        activityLoadState.value = 'not-found'
        return
      }

      activityData.value = activityPage.activity
      acEnabled.value = activityPage.activity.ac_enabled ?? false
      acFeePerSession.value = activityPage.activity.ac_fee ?? 0
      try {
        await fetchRegistrations(activityPage)
      } catch (error) {
        // 球局資料已成功取得時，名單的附屬查詢失敗不應覆蓋整個頁面。
        console.warn('Unable to load activity registrations', error)
      }
      activityLoadState.value = 'ready'
      nowTickInterval = setInterval(() => {
        nowTick.value = new Date()
      }, 1000)
      realtimeChannel = subscribeToRegistrationChanges(activityData.value.id, scheduleRegistrationRefresh, {
        includeGuests: !isSeasonSignupPage.value,
        seasonOnly: isSeasonSignupPage.value,
      })
    } catch {
      activityLoadState.value = 'error'
    }
  }

  onMounted(loadActivityPage)

  onUnmounted(() => {
    if (nowTickInterval) clearInterval(nowTickInterval)
    if (registrationRefreshTimer) clearTimeout(registrationRefreshTimer)
    removeRegistrationSubscription(realtimeChannel)
  })

  const navigation = { router }

  const activity = reactive({
    activityData,
    activityLoadState,
    activityNotFound,
    activityType,
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
    seasonPlanOpen: signupFlow.seasonPlanOpen,
    seasonPlanOptions: viewModels.seasonPlanOptions,
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
