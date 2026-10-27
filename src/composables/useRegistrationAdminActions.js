import { reactive, ref } from 'vue'
import { invokeRegistrationAction } from '~/services/registrationService'

export function useRegistrationAdminActions({ liffStore, activityData, getActivityId, registrations, fetchRegistrations, updatePayment, applyAcUpdate, focusElement, setSuccessDialogOpen }) {
  const removeDialog = reactive({ open: false, member: null })
  const removeConfirmButton = ref(null)

  async function togglePayment(member, field) {
    try {
      await updatePayment(member, field, () => {
        return invokeRegistrationAction(liffStore, {
          action: 'admin-toggle-payment',
          activityId: activityData.value?.id,
          registrationId: member._regId || null,
          memberType: member._memberType,
          guestId: member._guestId,
          field,
        })
      })
    } catch {
      setSuccessDialogOpen(true, { title: '繳費狀態更新失敗', copy: '請稍後再試。', buttonText: '確認' })
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
    if (member?._memberType !== 'guest' && !registration) return
    try {
      await invokeRegistrationAction(liffStore, {
        action: 'admin-remove-member',
        activityId: activityData.value?.id,
        registrationId: registration?.id || null,
        memberType: member._memberType,
        guestId: member._guestId,
      })
      try {
        await fetchRegistrations()
      } catch {
        /* The snapshot marks itself stale. */
      }
    } catch {
      // Keep the current list when remove fails.
    }
  }

  async function updateAcEnabled(enabled) {
    const activityId = getActivityId() || activityData.value?.id
    if (!activityId) return
    try {
      await applyAcUpdate(enabled, () => invokeRegistrationAction(liffStore, { action: 'admin-update-ac', activityId, enabled }))
    } catch {
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
