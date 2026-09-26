import { useSignupDialogs } from '~/composables/useSignupDialogs'
import { useSignupFormState } from '~/composables/useSignupFormState'
import { useSignupSubmission } from '~/composables/useSignupSubmission'

export function useSignupFlow({ liffStore, activityData, activityType, resolvedDate, isAdmin, myRegistration, mySeasonRegistration, mySeasonRegistrations, fetchRegistrations, viewModels }) {
  const formState = useSignupFormState({
    isAdmin,
    myRegistration,
    mySeasonRegistration,
    resolvedDate,
    viewModels,
  })
  const dialogs = useSignupDialogs({
    liffStore,
    resetSignupState: formState.resetSignupState,
    signupState: formState.signupState,
  })
  const submission = useSignupSubmission({
    liffStore,
    activityData,
    activityType,
    resolvedDate,
    myRegistration,
    mySeasonRegistration,
    mySeasonRegistrations,
    fetchRegistrations,
    viewModels,
    signupState: formState.signupState,
    showGuestValidation: formState.showGuestValidation,
    selectedSeasonPlan: formState.selectedSeasonPlan,
    isSignupChanged: formState.isSignupChanged,
    setSuccessDialogOpen: dialogs.setSuccessDialogOpen,
    setSignupOpen: dialogs.setSignupOpen,
    seasonCancelOpen: dialogs.seasonCancelOpen,
    seasonPlanOpen: dialogs.seasonPlanOpen,
  })
  function adjustSignupCount(type, direction) {
    if (type === 'self' && direction === -1 && viewModels.value.isSeasonLeaveMode.value && formState.signupState.self === 1) {
      dialogs.openLeaveConfirm()
      return
    }
    formState.adjustSignupCount(type, direction)
  }

  return {
    signupOpen: dialogs.signupOpen,
    isSubmitting: submission.isSubmitting,
    showGuestValidation: formState.showGuestValidation,
    seasonCancelOpen: dialogs.seasonCancelOpen,
    seasonPlanOpen: dialogs.seasonPlanOpen,
    selectedSeasonPlan: formState.selectedSeasonPlan,
    signupState: formState.signupState,
    guestLimit: formState.guestLimit,
    successDialog: dialogs.successDialog,
    leaveConfirmOpen: dialogs.leaveConfirmOpen,
    isSignupChanged: formState.isSignupChanged,
    heroCtaButton: dialogs.heroCtaButton,
    signupSheetRef: dialogs.signupSheetRef,
    successDialogButton: dialogs.successDialogButton,
    leaveConfirmButton: dialogs.leaveConfirmButton,
    focusElement: dialogs.focusElement,
    setSuccessDialogOpen: dialogs.setSuccessDialogOpen,
    handleDialogButtonClick: dialogs.handleDialogButtonClick,
    setSignupOpen: dialogs.setSignupOpen,
    adjustSignupCount,
    cancelLeaveConfirm: dialogs.cancelLeaveConfirm,
    confirmLeaveConfirm: dialogs.confirmLeaveConfirm,
    submitSignup: submission.submitSignup,
    handleCtaClick: submission.handleCtaClick,
    handleSeasonPlanConfirm: submission.handleSeasonPlanConfirm,
    confirmSeasonCancel: submission.confirmSeasonCancel,
    seasonCancelPlanLabel: submission.seasonCancelPlanLabel,
  }
}
