import { computed, reactive, ref, watch } from 'vue'
import { createActivityFormDefaults, getActivityFormErrors } from './useCreateActivityForm'
import { formatDateLabel } from './useCreateActivityCalendar'
import { addTaiwanDays, formatTaiwanDate, parseTaiwanDate } from '~/utils/taiwanDate'

function getQuarterSessionCount(dates) {
  const sortedDates = [...new Set(dates)].sort()
  if (!sortedDates.length) return 0

  const cutoffDate = parseTaiwanDate(sortedDates[0])
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() + 3, 1)
  const cutoff = formatTaiwanDate(cutoffDate)
  return sortedDates.filter(date => date < cutoff).length
}

export function useCreateActivityPageForm({ isPopulatingForm }) {
  const form = reactive(createActivityFormDefaults())
  const selectedDates = ref([])
  const seasonEnabled = ref(true)
  const isSeasonDisabledNoteAlert = ref(false)
  const errorFields = ref(new Set())

  const capacityOptions = ['unlimited', ...Array.from({ length: 18 }, (_, index) => String(index + 1))]
  const dayBeforeOptions = Array.from({ length: 7 }, (_, index) => `前 ${index + 1} 天`)
  const timeOptions = Array.from({ length: 24 * 60 }, (_, minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`)

  const activityDatesValue = computed(() => selectedDates.value.join(','))
  const selectedDateText = computed(() => (selectedDates.value.length ? selectedDates.value.map(formatDateLabel).join('、') : '請選擇日期'))
  const selectedDateCountText = computed(() => `共 ${selectedDates.value.length} 次`)
  const isSeasonAvailabilityDisabled = computed(() => selectedDates.value.length > 0 && selectedDates.value.length < 4)
  const seasonFee = computed(() => {
    const base = Number(form.seasonSingleFee || 0)
    const ac = form.seasonIncludeAc ? Number(form.acFee || 0) : 0
    const count = getQuarterSessionCount(selectedDates.value)
    return count > 0 ? String((base + ac) * count) : ''
  })
  const seasonFeeDigits = computed(() => Math.max(seasonFee.value.length, 1))

  const halfYearFee = computed(() => {
    const base = Number(form.halfYearSingleFee || 0)
    const ac = form.seasonIncludeAc ? Number(form.acFee || 0) : 0
    const count = selectedDates.value.length
    return count > 0 ? String((base + ac) * count) : ''
  })
  const halfYearFeeDigits = computed(() => Math.max(halfYearFee.value.length, 1))

  watch(
    () => form.activityStartTime,
    startTime => {
      if (isPopulatingForm.value || !startTime || form.activityEndTime) return
      const [h, m] = startTime.split(':').map(Number)
      const endH = (h + 3) % 24
      form.activityEndTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      clearError('activityEndTime')
    }
  )

  watch(
    selectedDates,
    dates => {
      if (isPopulatingForm.value) return
      clearError('activityDates')
      isSeasonDisabledNoteAlert.value = false

      if (dates.length > 0) {
        form.seasonOpenDate = addTaiwanDays(dates[0], -30)
        clearError('seasonOpenDate')
      }

      if (isSeasonAvailabilityDisabled.value) {
        seasonEnabled.value = false
      }
    },
    { deep: true }
  )

  function toggleSeason() {
    if (isSeasonAvailabilityDisabled.value) {
      isSeasonDisabledNoteAlert.value = true
      return
    }
    seasonEnabled.value = !seasonEnabled.value
  }

  function setChoice(field, value) {
    form[field] = value
    clearError(field)
  }

  function isError(field) {
    return errorFields.value.has(field)
  }

  function clearError(field) {
    if (!field || !errorFields.value.has(field)) return
    const nextErrors = new Set(errorFields.value)
    nextErrors.delete(field)
    errorFields.value = nextErrors
  }

  function validateForm() {
    errorFields.value = getActivityFormErrors(form, selectedDates, seasonEnabled)
    return errorFields.value.size === 0
  }

  return {
    form,
    selectedDates,
    seasonEnabled,
    isSeasonDisabledNoteAlert,
    errorFields,
    capacityOptions,
    dayBeforeOptions,
    timeOptions,
    activityDatesValue,
    selectedDateText,
    selectedDateCountText,
    isSeasonAvailabilityDisabled,
    seasonFee,
    seasonFeeDigits,
    halfYearFee,
    halfYearFeeDigits,
    toggleSeason,
    setChoice,
    isError,
    clearError,
    validateForm,
  }
}
