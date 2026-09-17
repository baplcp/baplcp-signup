import { reactive, ref } from 'vue'
import { invokeRegistrationAction } from '~/services/registrationService'

export function useRegistrationAdminActions({ liffStore, activityData, getActivityId, registrations, seasonRegistrations, acEnabled, fetchRegistrations, focusElement, setSuccessDialogOpen }) {
  const removeDialog = reactive({ open: false, member: null })
  const removeConfirmButton = ref(null)

  async function togglePayment(member, field) {
    const targetList = member._memberType === 'season_self' ? seasonRegistrations : registrations
    const registrationIndex = targetList.value.findIndex(registration => registration.id === member._regId)
    if (registrationIndex === -1) return
    const registration = targetList.value[registrationIndex]
    const updatedRegistration =
      member._memberType === 'guest'
        ? { ...registration, guests: (registration.guests || []).map((guest, index) => (index === member._guestIndex ? { ...guest, [field]: !(guest[field] ?? false) } : guest)) }
        : { ...registration, [field]: !(registration[field] ?? false) }
    targetList.value = targetList.value.map((currentRegistration, index) => (index === registrationIndex ? updatedRegistration : currentRegistration))

    try {
      await invokeRegistrationAction(liffStore, {
        action: 'admin-toggle-payment',
        activityId: activityData.value?.id,
        registrationId: registration.id,
        memberType: member._memberType,
        guestIndex: member._guestIndex,
        field,
      })
    } finally {
      await fetchRegistrations()
    }
  }

  function handleRemoveRequest(member) {
    removeDialog.member = member
    removeDialog.open = true
    focusElement(removeConfirmButton)
  }

  function cancelRemove() {
    removeDialog.open = false
    removeDialog.member = null
  }

  async function confirmRemove() {
    const member = removeDialog.member
    removeDialog.open = false
    removeDialog.member = null
    const registration = registrations.value.find(item => item.id === member?._regId)
    if (!registration) return
    try {
      await invokeRegistrationAction(liffStore, {
        action: 'admin-remove-member',
        activityId: activityData.value?.id,
        registrationId: registration.id,
        memberType: member._memberType,
        guestIndex: member._guestIndex,
      })
      await fetchRegistrations()
    } catch {
      // Keep the current list when remove fails.
    }
  }

  async function updateAcEnabled(enabled) {
    const previousEnabled = acEnabled.value
    acEnabled.value = enabled
    const activityId = getActivityId() || activityData.value?.id
    if (!activityId) {
      acEnabled.value = previousEnabled
      return
    }
    try {
      await invokeRegistrationAction(liffStore, { action: 'admin-update-ac', activityId, enabled })
    } catch {
      acEnabled.value = previousEnabled
      setSuccessDialogOpen(true, {
        title: '冷氣設定更新失敗',
        copy: '設定尚未變更，請稍後再試。',
        buttonText: '確認',
      })
    }
  }

  return {
    removeDialog,
    removeConfirmButton,
    togglePayment,
    handleRemoveRequest,
    cancelRemove,
    confirmRemove,
    updateAcEnabled,
  }
}
