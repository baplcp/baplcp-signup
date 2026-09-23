import { computed, ref, watch } from 'vue'
import { getTaiwanDateString, parseTaiwanDate } from '~/utils/taiwanDate'

export function getFirstDayOfMonth(date) {
  const month = new Date(date.getTime())
  month.setUTCDate(1)
  return month
}

export function formatDate(date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

export function formatDateLabel(value) {
  if (!value) return ''
  const parts = value.split('-')
  return `${Number(parts[1])}/${Number(parts[2])}`
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getUTCFullYear()
  const month = monthDate.getUTCMonth()
  const startOffset = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const gridStart = new Date(Date.UTC(year, month, 1 - startOffset))

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setUTCDate(gridStart.getUTCDate() + index)
    return {
      value: formatDate(date),
      label: String(date.getUTCDate()),
      isMuted: date.getUTCMonth() !== month,
    }
  })
}

export function useCreateActivityCalendar({ form, selectedDates, clearError }) {
  const calendarDays = ref([])
  const visibleMonth = ref(getFirstDayOfMonth(parseTaiwanDate(getTaiwanDateString())))
  const isCalendarOpen = ref(false)
  const activeCalendarTarget = ref('activity')

  const calendarTitle = computed(() => `${visibleMonth.value.getUTCFullYear()} 年 ${visibleMonth.value.getUTCMonth() + 1} 月`)
  const currentCalendarSelectedValues = computed(() => {
    if (activeCalendarTarget.value === 'season-open') return form.seasonOpenDate ? [form.seasonOpenDate] : []
    if (activeCalendarTarget.value === 'season-close') return form.seasonCloseDate ? [form.seasonCloseDate] : []
    return selectedDates.value
  })

  watch(visibleMonth, () => {
    calendarDays.value = buildCalendarDays(visibleMonth.value)
  })

  function initializeCalendar() {
    calendarDays.value = buildCalendarDays(visibleMonth.value)
  }

  function setVisibleMonthFromDate(value) {
    visibleMonth.value = getFirstDayOfMonth(parseTaiwanDate(value))
    calendarDays.value = buildCalendarDays(visibleMonth.value)
  }

  function openCalendar(target) {
    activeCalendarTarget.value = target
    isCalendarOpen.value = true
  }

  function closeCalendar() {
    isCalendarOpen.value = false
  }

  function changeCalendarMonth(offset) {
    const nextMonth = new Date(visibleMonth.value)
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + offset)
    visibleMonth.value = nextMonth
  }

  function selectCalendarDate(value) {
    if (activeCalendarTarget.value === 'season-open') {
      form.seasonOpenDate = value
      clearError('seasonOpenDate')
      return
    }

    if (activeCalendarTarget.value === 'season-close') {
      form.seasonCloseDate = value
      clearError('seasonCloseDate')
      return
    }

    const nextDates = [...selectedDates.value]
    const index = nextDates.indexOf(value)
    if (index === -1) nextDates.push(value)
    else nextDates.splice(index, 1)
    selectedDates.value = nextDates.sort()
  }

  return {
    calendarDays,
    isCalendarOpen,
    calendarTitle,
    currentCalendarSelectedValues,
    initializeCalendar,
    setVisibleMonthFromDate,
    openCalendar,
    closeCalendar,
    changeCalendarMonth,
    selectCalendarDate,
  }
}
