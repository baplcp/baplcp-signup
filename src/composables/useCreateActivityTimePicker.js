import { computed, ref } from 'vue'

export function useCreateActivityTimePicker({ form, clearError }) {
  const isTimePickerOpen = ref(false)
  const activeTimePickerField = ref('')
  const activeTimePickerValue = computed(() => (activeTimePickerField.value ? form[activeTimePickerField.value] : ''))

  function openTimePicker(field) {
    activeTimePickerField.value = field
    isTimePickerOpen.value = true
  }

  function closeTimePicker() {
    isTimePickerOpen.value = false
    activeTimePickerField.value = ''
  }

  function commitTimePicker(value) {
    if (!activeTimePickerField.value) return
    form[activeTimePickerField.value] = value
    clearError(activeTimePickerField.value)
    closeTimePicker()
  }

  return {
    isTimePickerOpen,
    activeTimePickerValue,
    openTimePicker,
    closeTimePicker,
    commitTimePicker,
  }
}
