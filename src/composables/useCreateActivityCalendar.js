import { computed, ref, watch } from 'vue'

export function getFirstDayOfMonth(date) {
  const month = new Date(date)
  month.setDate(1)
  return month
}

export function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function formatDateLabel(value) {
  if (!value) return ''
  const parts = value.split('-')
  return `${Number(parts[1])}/${Number(parts[2])}`
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const startOffset = new Date(year, month, 1).getDay()
  const gridStart = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return {
      value: formatDate(date),
      label: String(date.getDate()),
      isMuted: date.getMonth() !== month,
    }
  })
}

export function useCreateActivityCalendar({ form, selectedDates, clearError }) {
  const calendarDays = ref([])
  const visibleMonth = ref(getFirstDayOfMonth(new Date()))
  const isCalendarOpen = ref(false)
  const activeCalendarTarget = ref('activity')

  const calendarTitle = computed(() => `${visibleMonth.value.getFullYear()} 年 ${visibleMonth.value.getMonth() + 1} 月`)
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
    visibleMonth.value = getFirstDayOfMonth(new Date(value))
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
    nextMonth.setMonth(nextMonth.getMonth() + offset)
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
