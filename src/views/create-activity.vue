<script setup>
import { createClient } from '@supabase/supabase-js'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const SUPABASE_URL = 'https://rkmxoqopptyuqhbeswqo.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbXhvcW9wcHR5dXFoYmVzd3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODU1NzMsImV4cCI6MjA5MjA2MTU3M30.r_Mows0iPF_FULtFJGCQctxERy8E5JCIndyD-llDbIA'
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const api = {
  async createActivity(payload) {
    const { data, error } = await client.from('activities').insert(payload).select().single()
    if (error) throw error
    return data
  },
}

const form = reactive({
  gameType: 'season',
  activityTitle: '',
  location: '',
  activityStartTime: '',
  activityEndTime: '',
  seasonSingleFee: '',
  pickupSingleFee: '',
  acFee: '',
  singleCapacity: '18',
  seasonIncludeAc: true,
  seasonCapacity: 'unlimited',
  seasonOpenDate: '',
  seasonOpenTime: '00:00',
  seasonDeadlineType: 'unlimited',
  seasonCloseDate: '',
  seasonCloseTime: '',
  pickupOpenDate: '前 7 天',
  pickupOpenTime: '20:00',
  deadlineType: 'unlimited',
  pickupCloseDate: '前 1 天',
  pickupCloseTime: '20:00',
})

const submitButton = ref(null)
const createDialogButton = ref(null)
const calendarDays = ref([])
const selectedDates = ref([])
const visibleMonth = ref(getFirstDayOfMonth(new Date()))
const isCalendarOpen = ref(false)
const activeCalendarTarget = ref('activity')
const seasonEnabled = ref(true)
const isSeasonDisabledNoteAlert = ref(false)
const isSubmitting = ref(false)
const errorFields = ref(new Set())

const dialog = reactive({
  isOpen: false,
  title: '球局建立成功',
  copy: '新球局已建立完成。',
  buttonText: '確認',
  returnAfterClose: false,
})

const timePicker = reactive({
  isOpen: false,
  activeField: '',
  value: { hour: '06', minute: '00', period: 'AM' },
})

const timeWheelRefs = {
  hour: ref(null),
  minute: ref(null),
  period: ref(null),
}
const scrollTimers = new Map()

const capacityOptions = ['unlimited', ...Array.from({ length: 18 }, (_, index) => String(index + 1))]
const dayBeforeOptions = Array.from({ length: 7 }, (_, index) => `前 ${index + 1} 天`)
const timeOptions = Array.from({ length: 24 * 60 }, (_, minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`)
const hours = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))
const periods = ['AM', 'PM']

const activityDatesValue = computed(() => selectedDates.value.join(','))
const selectedDateText = computed(() => (selectedDates.value.length ? selectedDates.value.map(formatDateLabel).join('、') : '請選擇日期'))
const selectedDateCountText = computed(() => `共 ${selectedDates.value.length} 次`)
const calendarTitle = computed(() => `${visibleMonth.value.getFullYear()} 年 ${visibleMonth.value.getMonth() + 1} 月`)
const isSeasonAvailabilityDisabled = computed(() => selectedDates.value.length > 0 && selectedDates.value.length < 4)
const seasonFee = computed(() => {
  const base = Number(form.seasonSingleFee || 0)
  const ac = form.seasonIncludeAc ? Number(form.acFee || 0) : 0
  const count = selectedDates.value.length
  return count > 0 ? String((base + ac) * count) : ''
})
const seasonFeeDigits = computed(() => Math.max(seasonFee.value.length, 1))
const currentCalendarSelectedValues = computed(() => {
  if (activeCalendarTarget.value === 'season-open') return form.seasonOpenDate ? [form.seasonOpenDate] : []
  if (activeCalendarTarget.value === 'season-close') return form.seasonCloseDate ? [form.seasonCloseDate] : []
  return selectedDates.value
})

watch(
  selectedDates,
  dates => {
    clearError('activityDates')
    isSeasonDisabledNoteAlert.value = false

    if (dates.length > 0) {
      const earliest = new Date(dates[0])
      earliest.setDate(earliest.getDate() - 30)
      form.seasonOpenDate = formatDate(earliest)
      clearError('seasonOpenDate')
    }

    if (isSeasonAvailabilityDisabled.value) {
      seasonEnabled.value = false
    }
  },
  { deep: true }
)

watch(visibleMonth, () => {
  calendarDays.value = buildCalendarDays(visibleMonth.value)
})

onMounted(() => {
  calendarDays.value = buildCalendarDays(visibleMonth.value)
})

onBeforeUnmount(() => {
  scrollTimers.forEach(timer => clearTimeout(timer))
})

function getFirstDayOfMonth(date) {
  const month = new Date(date)
  month.setDate(1)
  return month
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatDateLabel(value) {
  if (!value) return ''
  const parts = value.split('-')
  return `${Number(parts[1])}/${Number(parts[2])}`
}

function to24Hour(hour, minute, period) {
  let h = Number(hour)
  if (period === 'AM') h = h === 12 ? 0 : h
  else h = h === 12 ? 12 : h + 12
  return `${String(h).padStart(2, '0')}:${minute}`
}

function from24Hour(value) {
  if (!value) return { hour: '06', minute: '00', period: 'AM' }
  const parts = value.split(':')
  const h = Number(parts[0])
  return {
    hour: String(h % 12 || 12).padStart(2, '0'),
    minute: parts[1] || '00',
    period: h >= 12 ? 'PM' : 'AM',
  }
}

function parseDaysBefore(raw) {
  const match = (raw || '').match(/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

function returnToPreviousPage() {
  if (window.history.length > 1) window.history.back()
  else window.location.href = './group-list.html'
}

function goToCreatedActivityList() {
  window.location.href = './group-list.html'
}

function openCreateDialog(options = {}) {
  dialog.title = options.title || dialog.title
  dialog.copy = options.copy || dialog.copy
  dialog.buttonText = options.buttonText || dialog.buttonText
  dialog.returnAfterClose = Boolean(options.returnAfterClose)
  dialog.isOpen = true
  nextTick(() => createDialogButton.value?.focus({ preventScroll: true }))
}

function closeCreateDialog() {
  const shouldReturn = dialog.returnAfterClose
  dialog.isOpen = false
  dialog.returnAfterClose = false
  nextTick(() => submitButton.value?.focus({ preventScroll: true }))
  if (shouldReturn) goToCreatedActivityList()
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

function onChoiceKeydown(event, field, value) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  setChoice(field, value)
}

function isChoiceActive(field, value) {
  return form[field] === value
}

function isChoiceCondensed(field) {
  return form[field] === 'unlimited'
}

function openTimePicker(field) {
  timePicker.activeField = field
  timePicker.value = from24Hour(form[field])
  timePicker.isOpen = true
  nextTick(() => {
    scrollToTimeValue('hour', timePicker.value.hour)
    scrollToTimeValue('minute', timePicker.value.minute)
    scrollToTimeValue('period', timePicker.value.period)
  })
}

function closeTimePicker() {
  timePicker.isOpen = false
  timePicker.activeField = ''
}

function commitTimePicker() {
  if (!timePicker.activeField) return
  form[timePicker.activeField] = to24Hour(timePicker.value.hour, timePicker.value.minute, timePicker.value.period)
  clearError(timePicker.activeField)
  closeTimePicker()
}

function stepTime(key, direction, values) {
  let index = values.indexOf(timePicker.value[key]) + Number(direction)
  if (index < 0) index = values.length - 1
  if (index >= values.length) index = 0
  timePicker.value[key] = values[index]
  scrollToTimeValue(key, timePicker.value[key], 'smooth')
}

function scrollToTimeValue(key, value, behavior = 'auto') {
  const wheel = timeWheelRefs[key].value
  if (!wheel) return

  const options = Array.from(wheel.children)
  const option = options.find(child => child.dataset.value === value)
  if (!option) return

  wheel.scrollTo({
    top: option.offsetTop - (wheel.clientHeight - option.offsetHeight) / 2,
    behavior,
  })
}

function onTimeWheelScroll(event, key, values) {
  const wheel = event.currentTarget
  clearTimeout(scrollTimers.get(wheel))

  const timer = setTimeout(() => {
    const options = Array.from(wheel.children)
    const center = wheel.getBoundingClientRect().top + wheel.clientHeight / 2
    const closest = options.reduce((current, option, index) => {
      const distance = Math.abs(option.getBoundingClientRect().top + option.offsetHeight / 2 - center)
      return !current || distance < current.distance ? { index, distance } : current
    }, null)

    if (closest) timePicker.value[key] = values[closest.index]
    scrollTimers.delete(wheel)
  }, 90)

  scrollTimers.set(wheel, timer)
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

function validate() {
  const checks = [
    { field: 'activityTitle', ok: form.activityTitle.trim() !== '' },
    { field: 'location', ok: form.location.trim() !== '' },
    { field: 'activityDates', ok: selectedDates.value.length > 0 },
    { field: 'activityStartTime', ok: form.activityStartTime !== '' },
    { field: 'activityEndTime', ok: form.activityEndTime !== '' },
    { field: 'seasonSingleFee', ok: String(form.seasonSingleFee).trim() !== '' },
    { field: 'pickupSingleFee', ok: String(form.pickupSingleFee).trim() !== '' },
    { field: 'acFee', ok: String(form.acFee).trim() !== '' },
    { field: 'singleCapacity', ok: String(form.singleCapacity).trim() !== '' },
    { field: 'pickupOpenDate', ok: form.pickupOpenDate !== '' },
    { field: 'pickupOpenTime', ok: form.pickupOpenTime !== '' },
  ]

  if (seasonEnabled.value) {
    checks.push(
      { field: 'seasonCapacity', ok: form.seasonCapacity !== '' },
      { field: 'seasonOpenDate', ok: form.seasonOpenDate !== '' },
      { field: 'seasonOpenTime', ok: form.seasonOpenTime !== '' }
    )

    if (form.seasonDeadlineType === 'custom') {
      checks.push({ field: 'seasonCloseDate', ok: form.seasonCloseDate !== '' }, { field: 'seasonCloseTime', ok: form.seasonCloseTime !== '' })
    }
  }

  if (form.deadlineType === 'custom') {
    checks.push({ field: 'pickupCloseDate', ok: form.pickupCloseDate !== '' }, { field: 'pickupCloseTime', ok: form.pickupCloseTime !== '' })
  }

  errorFields.value = new Set(checks.filter(({ ok }) => !ok).map(({ field }) => field))

  if (errorFields.value.size > 0) {
    openCreateDialog({
      title: '報名尚未完成',
      copy: '有部分必填欄位尚未填寫，請確認標示的欄位後再送出。',
      buttonText: '確認',
      returnAfterClose: false,
    })
    return false
  }

  return true
}

function buildActivityPayload() {
  return {
    game_type: form.gameType || 'season',
    title: form.activityTitle || '',
    location: form.location || '',
    dates: selectedDates.value,
    start_time: form.activityStartTime || null,
    end_time: form.activityEndTime || null,
    season_fee_per_session: Number(form.seasonSingleFee) || 0,
    pickup_fee_per_session: Number(form.pickupSingleFee) || 0,
    ac_fee: Number(form.acFee) || 0,
    single_capacity: Number(form.singleCapacity) || 18,
    season_enabled: seasonEnabled.value,
    season_include_ac: form.seasonIncludeAc,
    season_total_fee: Number(seasonFee.value) || 0,
    season_capacity: form.seasonCapacity || null,
    season_open_date: form.seasonOpenDate || null,
    season_open_time: form.seasonOpenTime || null,
    season_deadline_type: form.seasonDeadlineType || 'unlimited',
    season_close_date: form.seasonCloseDate || null,
    season_close_time: form.seasonCloseTime || null,
    pickup_open_days_before: parseDaysBefore(form.pickupOpenDate),
    pickup_open_time: form.pickupOpenTime || null,
    pickup_deadline_type: form.deadlineType || 'unlimited',
    pickup_close_days_before: parseDaysBefore(form.pickupCloseDate),
    pickup_close_time: form.pickupCloseTime || null,
  }
}

async function handleCreateActivity() {
  if (!validate()) return

  isSubmitting.value = true
  try {
    await api.createActivity(buildActivityPayload())
    openCreateDialog({
      title: '球局建立成功',
      copy: '新球局已建立完成。',
      buttonText: '確認',
      returnAfterClose: true,
    })
  } catch (err) {
    openCreateDialog({
      title: '建立失敗',
      copy: err.message || '請稍後再試',
      buttonText: '確認',
      returnAfterClose: false,
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="app-shell">
    <div class="app-scroll">
      <header class="sheet-topbar">
        <button class="cancel-link" type="button" @click="returnToPreviousPage">取消</button>
      </header>

      <section class="page">
        <h1 class="page-title">建立新球局</h1>

        <form id="create-activity-form" class="form-block" @submit.prevent="handleCreateActivity">
          <section class="section" aria-labelledby="details-title">
            <h2 id="details-title" class="section-title">詳細資訊</h2>
            <input v-model="form.gameType" name="gameType" type="hidden" />

            <label class="field">
              <span class="field-label">標題</span>
              <input v-model="form.activityTitle" name="activityTitle" type="text" autocomplete="off" :class="{ 'is-error': isError('activityTitle') }" @input="clearError('activityTitle')" />
            </label>

            <label class="field">
              <span class="field-label">地點</span>
              <input v-model="form.location" name="location" type="text" autocomplete="off" :class="{ 'is-error': isError('location') }" @input="clearError('location')" />
            </label>

            <div class="field">
              <p class="field-label">日期（多選）</p>
              <button id="date-picker-button" class="control-button" :class="{ 'has-value': selectedDates.length > 0, 'is-error': isError('activityDates') }" type="button" @click="openCalendar('activity')">
                {{ selectedDateText }}
              </button>
              <input :value="activityDatesValue" name="activityDates" type="hidden" />
              <p v-if="selectedDates.length > 0" class="date-count-note helper-note">{{ selectedDateCountText }}</p>
            </div>

            <div class="field">
              <p class="field-label">時間</p>
              <div class="time-row">
                <span class="select-wrap" @click="openTimePicker('activityStartTime')">
                  <select v-model="form.activityStartTime" name="activityStartTime" data-time-select :class="{ 'is-placeholder': form.activityStartTime === '', 'is-error': isError('activityStartTime') }" @change="clearError('activityStartTime')">
                    <option value="">開始時間</option>
                    <option v-for="time in timeOptions" :key="`activity-start-${time}`" :value="time">{{ time }}</option>
                  </select>
                </span>
                <span class="inline-text">至</span>
                <span class="select-wrap" @click="openTimePicker('activityEndTime')">
                  <select v-model="form.activityEndTime" name="activityEndTime" data-time-select :class="{ 'is-placeholder': form.activityEndTime === '', 'is-error': isError('activityEndTime') }" @change="clearError('activityEndTime')">
                    <option value="">結束時間</option>
                    <option v-for="time in timeOptions" :key="`activity-end-${time}`" :value="time">{{ time }}</option>
                  </select>
                </span>
              </div>
            </div>

            <div class="field">
              <p class="field-label">單次收費</p>
              <div class="fee-grid">
                <label class="fee-mini-field">
                  <span class="mini-label">季打</span>
                  <span class="money-input" :class="{ 'is-error': isError('seasonSingleFee') }">
                    <span>$</span>
                    <input id="season-single-fee" v-model="form.seasonSingleFee" name="seasonSingleFee" type="number" min="0" inputmode="numeric" @input="clearError('seasonSingleFee')" />
                  </span>
                </label>
                <label class="fee-mini-field">
                  <span class="mini-label">臨打</span>
                  <span class="money-input" :class="{ 'is-error': isError('pickupSingleFee') }">
                    <span>$</span>
                    <input id="pickup-single-fee" v-model="form.pickupSingleFee" name="pickupSingleFee" type="number" min="0" inputmode="numeric" @input="clearError('pickupSingleFee')" />
                  </span>
                </label>
                <label class="fee-mini-field">
                  <span class="mini-label">冷氣</span>
                  <span class="money-input" :class="{ 'is-error': isError('acFee') }">
                    <span>$</span>
                    <input id="ac-fee" v-model="form.acFee" name="acFee" type="number" min="0" inputmode="numeric" @input="clearError('acFee')" />
                  </span>
                </label>
              </div>
            </div>

            <label class="field">
              <span class="field-label">單次人數</span>
              <input v-model="form.singleCapacity" name="singleCapacity" type="number" min="1" inputmode="numeric" :class="{ 'is-error': isError('singleCapacity') }" @input="clearError('singleCapacity')" />
            </label>
          </section>

          <div class="section-divider" aria-hidden="true"></div>

          <section class="section season-area" :class="{ 'is-collapsed': !seasonEnabled }" aria-labelledby="season-title">
            <div class="section-header">
              <div>
                <h2 id="season-title" class="section-title">季打報名開放</h2>
                <p v-if="isSeasonAvailabilityDisabled" class="section-note" :class="{ 'is-alert': isSeasonDisabledNoteAlert }">球局次數需 4 次以上</p>
              </div>
              <button class="switch" :class="{ 'is-on': seasonEnabled, 'is-disabled': isSeasonAvailabilityDisabled }" type="button" role="switch" :aria-checked="String(seasonEnabled)" :aria-disabled="String(isSeasonAvailabilityDisabled)" aria-label="季打報名開放" @click="toggleSeason"></button>
            </div>

            <div class="field-list season-fields" :class="{ 'is-collapsed': !seasonEnabled }">
              <div class="field">
                <p class="field-label"><strong>季打費用</strong></p>
                <div class="fee-card">
                  <label class="fee-check-row">
                    <input id="season-include-ac" v-model="form.seasonIncludeAc" name="seasonIncludeAc" type="checkbox" hidden />
                    <span class="fee-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M5 12.5L9.5 17L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span>
                    <span>含冷氣費</span>
                  </label>
                  <label class="fee-input-row">
                    <span>$</span>
                    <input id="season-fee" :value="seasonFee" name="seasonFee" type="text" inputmode="numeric" aria-label="季打費用" placeholder=" " readonly :style="{ '--season-fee-digits': seasonFeeDigits }" />
                    <span class="fee-unit">/人</span>
                  </label>
                </div>
                <p class="auto-note fee-note">*自動填入</p>
              </div>

              <label class="field">
                <span class="field-label">季打名額</span>
                <span class="select-wrap">
                  <select id="season-capacity" v-model="form.seasonCapacity" name="seasonCapacity" :class="{ 'is-placeholder': form.seasonCapacity === '', 'is-error': isError('seasonCapacity') }" @change="clearError('seasonCapacity')">
                    <option value="">請選擇人數</option>
                    <option v-for="option in capacityOptions" :key="`season-capacity-${option}`" :value="option">{{ option === 'unlimited' ? '不限' : option }}</option>
                  </select>
                </span>
              </label>

              <div class="field">
                <p class="field-label">季打開放報名時間</p>
                <div class="time-row">
                  <button id="season-open-date-button" class="control-button" :class="{ 'has-value': form.seasonOpenDate, 'is-error': isError('seasonOpenDate') }" type="button" @click="openCalendar('season-open')">
                    {{ form.seasonOpenDate ? formatDateLabel(form.seasonOpenDate) : '請選擇日期' }}
                  </button>
                  <input v-model="form.seasonOpenDate" name="seasonOpenDate" type="hidden" />
                  <span class="inline-text">的</span>
                  <span class="select-wrap" @click="openTimePicker('seasonOpenTime')">
                    <select id="season-open-time" v-model="form.seasonOpenTime" name="seasonOpenTime" data-time-select :class="{ 'is-placeholder': form.seasonOpenTime === '', 'is-error': isError('seasonOpenTime') }" @change="clearError('seasonOpenTime')">
                      <option value="">幾點</option>
                      <option v-for="time in timeOptions" :key="`season-open-${time}`" :value="time">{{ time }}</option>
                    </select>
                  </span>
                </div>
              </div>

              <div class="field">
                <p class="field-label"><strong>季打截止時間</strong></p>
                <div class="choice-stack">
                  <div class="choice-card" :class="{ 'is-active': isChoiceActive('seasonDeadlineType', 'unlimited'), 'is-condensed': isChoiceCondensed('seasonDeadlineType') }" role="button" tabindex="0" :aria-pressed="String(isChoiceActive('seasonDeadlineType', 'unlimited'))" @click="setChoice('seasonDeadlineType', 'unlimited')" @keydown="onChoiceKeydown($event, 'seasonDeadlineType', 'unlimited')">
                    <span class="radio-mark" aria-hidden="true"></span>
                    <span class="choice-summary">
                      <span class="choice-title">不限時間</span>
                      <span class="choice-copy">管理員可手動關閉</span>
                    </span>
                  </div>
                  <div class="choice-card" :class="{ 'is-active': isChoiceActive('seasonDeadlineType', 'custom'), 'is-condensed': isChoiceCondensed('seasonDeadlineType') }" role="button" tabindex="0" :aria-pressed="String(isChoiceActive('seasonDeadlineType', 'custom'))" @click="setChoice('seasonDeadlineType', 'custom')" @keydown="onChoiceKeydown($event, 'seasonDeadlineType', 'custom')">
                    <span class="radio-mark" aria-hidden="true"></span>
                    <span class="choice-content">
                      <span class="choice-title">設定截止時間</span>
                      <span class="choice-rule is-date-time">
                        <button id="season-close-date-button" class="control-button" :class="{ 'has-value': form.seasonCloseDate, 'is-error': isError('seasonCloseDate') }" type="button" @click.stop="setChoice('seasonDeadlineType', 'custom'); openCalendar('season-close')">
                          {{ form.seasonCloseDate ? formatDateLabel(form.seasonCloseDate) : '請選擇日期' }}
                        </button>
                        <input v-model="form.seasonCloseDate" name="seasonCloseDate" type="hidden" />
                        <span>的</span>
                        <span class="select-wrap" @click.stop="setChoice('seasonDeadlineType', 'custom'); openTimePicker('seasonCloseTime')">
                          <select id="season-close-time" v-model="form.seasonCloseTime" name="seasonCloseTime" data-time-select :class="{ 'is-placeholder': form.seasonCloseTime === '', 'is-error': isError('seasonCloseTime') }" @change="clearError('seasonCloseTime')">
                            <option value="">幾點</option>
                            <option v-for="time in timeOptions" :key="`season-close-${time}`" :value="time">{{ time }}</option>
                          </select>
                        </span>
                      </span>
                    </span>
                  </div>
                </div>
                <input v-model="form.seasonDeadlineType" name="seasonDeadlineType" type="hidden" />
              </div>
            </div>
          </section>

          <div class="section-divider" aria-hidden="true"></div>

          <section class="section" aria-labelledby="pickup-title">
            <h2 id="pickup-title" class="section-title">臨打報名</h2>
            <div class="field">
              <p class="field-label">開放時間</p>
              <div class="time-row is-rule">
                <span class="inline-text">每次活動</span>
                <span class="select-wrap">
                  <select v-model="form.pickupOpenDate" name="pickupOpenDate" :class="{ 'is-placeholder': form.pickupOpenDate === '', 'is-error': isError('pickupOpenDate') }" @change="clearError('pickupOpenDate')">
                    <option value="">幾天前</option>
                    <option v-for="option in dayBeforeOptions" :key="`pickup-open-date-${option}`" :value="option">{{ option }}</option>
                  </select>
                </span>
                <span class="inline-text">的</span>
                <span class="select-wrap" @click="openTimePicker('pickupOpenTime')">
                  <select v-model="form.pickupOpenTime" name="pickupOpenTime" data-time-select :class="{ 'is-placeholder': form.pickupOpenTime === '', 'is-error': isError('pickupOpenTime') }" @change="clearError('pickupOpenTime')">
                    <option value="">幾點</option>
                    <option v-for="time in timeOptions" :key="`pickup-open-${time}`" :value="time">{{ time }}</option>
                  </select>
                </span>
              </div>
            </div>

            <div class="field">
              <p class="field-label"><strong>截止時間</strong></p>
              <div class="choice-stack">
                <div class="choice-card" :class="{ 'is-active': isChoiceActive('deadlineType', 'unlimited'), 'is-condensed': isChoiceCondensed('deadlineType') }" role="button" tabindex="0" :aria-pressed="String(isChoiceActive('deadlineType', 'unlimited'))" @click="setChoice('deadlineType', 'unlimited')" @keydown="onChoiceKeydown($event, 'deadlineType', 'unlimited')">
                  <span class="radio-mark" aria-hidden="true"></span>
                  <span class="choice-summary">
                    <span class="choice-title">不限時間</span>
                    <span class="choice-copy">活動開始前皆可報名</span>
                  </span>
                </div>
                <div class="choice-card" :class="{ 'is-active': isChoiceActive('deadlineType', 'custom'), 'is-condensed': isChoiceCondensed('deadlineType') }" role="button" tabindex="0" :aria-pressed="String(isChoiceActive('deadlineType', 'custom'))" @click="setChoice('deadlineType', 'custom')" @keydown="onChoiceKeydown($event, 'deadlineType', 'custom')">
                  <span class="radio-mark" aria-hidden="true"></span>
                  <span class="choice-content">
                    <span class="choice-title">設定截止時間</span>
                    <span class="choice-rule">
                      <span>每次活動</span>
                      <span class="select-wrap" @click.stop="setChoice('deadlineType', 'custom')">
                        <select v-model="form.pickupCloseDate" name="pickupCloseDate" :class="{ 'is-placeholder': form.pickupCloseDate === '', 'is-error': isError('pickupCloseDate') }" @change="clearError('pickupCloseDate')">
                          <option value="">幾天前</option>
                          <option v-for="option in dayBeforeOptions" :key="`pickup-close-date-${option}`" :value="option">{{ option }}</option>
                        </select>
                      </span>
                      <span>的</span>
                      <span class="select-wrap" @click.stop="setChoice('deadlineType', 'custom'); openTimePicker('pickupCloseTime')">
                        <select v-model="form.pickupCloseTime" name="pickupCloseTime" data-time-select :class="{ 'is-placeholder': form.pickupCloseTime === '', 'is-error': isError('pickupCloseTime') }" @change="clearError('pickupCloseTime')">
                          <option value="">幾點</option>
                          <option v-for="time in timeOptions" :key="`pickup-close-${time}`" :value="time">{{ time }}</option>
                        </select>
                      </span>
                    </span>
                  </span>
                </div>
              </div>
              <input v-model="form.deadlineType" name="deadlineType" type="hidden" />
            </div>
          </section>
        </form>
      </section>
    </div>

    <div class="cta-fade">
      <button ref="submitButton" class="submit-button" type="submit" form="create-activity-form" :disabled="isSubmitting">{{ isSubmitting ? '建立中...' : '建立球局' }}</button>
    </div>

    <div class="calendar-overlay" :class="{ 'is-open': isCalendarOpen }" :aria-hidden="String(!isCalendarOpen)" @click.self="closeCalendar">
      <section class="calendar-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
        <div class="calendar-header">
          <button class="calendar-nav" type="button" aria-label="上一個月" @click="changeCalendarMonth(-1)">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <h2 id="calendar-title" class="calendar-title">{{ calendarTitle }}</h2>
          <button class="calendar-nav" type="button" aria-label="下一個月" @click="changeCalendarMonth(1)">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
              <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div class="calendar-weekdays" aria-hidden="true"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
        <div class="calendar-grid">
          <button v-for="day in calendarDays" :key="day.value" class="calendar-day" :class="{ 'is-muted': day.isMuted, 'is-selected': currentCalendarSelectedValues.includes(day.value) }" type="button" @click="selectCalendarDate(day.value)">
            {{ day.label }}
          </button>
        </div>
        <div class="calendar-actions">
          <button class="calendar-action is-muted" type="button" @click="closeCalendar">取消</button>
          <button class="calendar-action is-primary" type="button" @click="closeCalendar">完成</button>
        </div>
      </section>
    </div>

    <div class="time-overlay" :class="{ 'is-open': timePicker.isOpen }" :aria-hidden="String(!timePicker.isOpen)" @click.self="closeTimePicker">
      <section class="time-sheet" role="dialog" aria-modal="true" aria-labelledby="time-title">
        <div class="time-header">
          <h2 id="time-title" class="time-title">選擇時間</h2>
          <button class="time-close" type="button" @click="commitTimePicker">完成</button>
        </div>
        <div class="time-wheels" aria-label="時間選擇器">
          <div class="time-wheel-column">
            <button class="time-wheel-arrow" type="button" aria-label="小時減少" @click="stepTime('hour', -1, hours)">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 14L12 9L17 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div :ref="el => (timeWheelRefs.hour.value = el)" class="time-wheel" aria-label="小時" @scroll.passive="onTimeWheelScroll($event, 'hour', hours)">
              <button v-for="hour in hours" :key="`hour-${hour}`" class="time-wheel-option" :class="{ 'is-selected': timePicker.value.hour === hour }" type="button" :data-value="hour" @click="timePicker.value.hour = hour; scrollToTimeValue('hour', hour, 'smooth')">{{ hour }}</button>
            </div>
            <button class="time-wheel-arrow" type="button" aria-label="小時增加" @click="stepTime('hour', 1, hours)">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
          <div class="time-wheel-column">
            <button class="time-wheel-arrow" type="button" aria-label="分鐘減少" @click="stepTime('minute', -1, minutes)">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 14L12 9L17 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div :ref="el => (timeWheelRefs.minute.value = el)" class="time-wheel" aria-label="分鐘" @scroll.passive="onTimeWheelScroll($event, 'minute', minutes)">
              <button v-for="minute in minutes" :key="`minute-${minute}`" class="time-wheel-option" :class="{ 'is-selected': timePicker.value.minute === minute }" type="button" :data-value="minute" @click="timePicker.value.minute = minute; scrollToTimeValue('minute', minute, 'smooth')">{{ minute }}</button>
            </div>
            <button class="time-wheel-arrow" type="button" aria-label="分鐘增加" @click="stepTime('minute', 1, minutes)">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
          <div class="time-wheel-column">
            <button class="time-wheel-arrow" type="button" aria-label="上午下午切換" @click="stepTime('period', -1, periods)">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 14L12 9L17 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div :ref="el => (timeWheelRefs.period.value = el)" class="time-wheel" aria-label="上午或下午" @scroll.passive="onTimeWheelScroll($event, 'period', periods)">
              <button v-for="period in periods" :key="`period-${period}`" class="time-wheel-option" :class="{ 'is-selected': timePicker.value.period === period }" type="button" :data-value="period" @click="timePicker.value.period = period; scrollToTimeValue('period', period, 'smooth')">{{ period }}</button>
            </div>
            <button class="time-wheel-arrow" type="button" aria-label="上午下午切換" @click="stepTime('period', 1, periods)">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        <div class="time-actions">
          <button class="time-action is-muted" type="button" @click="closeTimePicker">取消</button>
          <button class="time-action is-primary" type="button" @click="commitTimePicker">完成</button>
        </div>
      </section>
    </div>

    <div class="success-dialog-overlay" :class="{ 'is-open': dialog.isOpen }" :aria-hidden="String(!dialog.isOpen)" :inert="!dialog.isOpen" @click.self="closeCreateDialog" @keydown.esc="closeCreateDialog">
      <section class="success-dialog" role="dialog" aria-modal="true" aria-labelledby="create-dialog-title">
        <h2 id="create-dialog-title" class="success-dialog-title">{{ dialog.title }}</h2>
        <p class="success-dialog-copy">{{ dialog.copy }}</p>
        <button ref="createDialogButton" class="success-dialog-button" type="button" @click="closeCreateDialog">{{ dialog.buttonText }}</button>
      </section>
    </div>
  </main>
</template>

<style>
:root {
  --primary: #6574ff;
  --secondary: #1bc4bf;
  --text: #101840;
  --muted: #8f95b2;
  --muted-soft: #8f95b2;
  --line: #d8dae5;
  --line-soft: #e6e8f0;
  --section: #f6f6f6;
  --surface: #ffffff;
  --selected: #eef1ff;
  --shadow: 0 24px 64px rgba(30, 42, 110, 0.16);
}

* {
  box-sizing: border-box;
  touch-action: manipulation;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  color: var(--text);
  background: radial-gradient(circle at top, rgba(87, 104, 255, 0.14), transparent 32%), linear-gradient(180deg, #f5f6fb 0%, #edf0f8 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 16px;
}

button,
input,
select {
  font: inherit;
}

button {
  border: 0;
  padding: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}

input,
select {
  width: 100%;
  min-height: 41px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  color: var(--text);
  font-size: 15px;
  line-height: 1.5;
  outline: none;
  appearance: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

input::placeholder {
  color: var(--muted-soft);
}

select.is-placeholder {
  color: var(--muted-soft);
}

input:focus,
select:focus,
.control-button:focus {
  border-color: rgba(87, 104, 255, 0.72);
  box-shadow: 0 0 0 3px rgba(87, 104, 255, 0.12);
}

select {
  background-image: linear-gradient(45deg, transparent 50%, #646a80 50%), linear-gradient(135deg, #646a80 50%, transparent 50%);
  background-position:
    calc(100% - 18px) 50%,
    calc(100% - 12px) 50%;
  background-size:
    6px 6px,
    6px 6px;
  background-repeat: no-repeat;
  padding-right: 36px;
}

.app-shell {
  width: min(100%, 390px);
  height: min(844px, calc(100vh - 48px));
  background: var(--surface);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: var(--shadow);
  position: relative;
}

.app-scroll {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 188px;
}

.app-scroll::-webkit-scrollbar {
  display: none;
}

.sheet-topbar {
  position: sticky;
  top: 0;
  z-index: 6;
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
}

.cancel-link {
  color: var(--muted-soft);
  font-size: 15px;
  line-height: 1.4;
}

.page {
  padding: 24px 16px 0;
}

.page-title {
  margin: 0 0 20px;
  color: var(--text);
  font-size: 24px;
  line-height: 1.36;
  letter-spacing: 0.48px;
  font-weight: 600;
}

.form-block,
.section,
.field-list,
.field {
  display: grid;
}

.section {
  gap: 18px;
}

.section-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.36;
  letter-spacing: 0.36px;
  font-weight: 600;
}

.section-note {
  margin: 4px 0 0;
  color: var(--muted-soft);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 400;
}

.section-note.is-alert {
  color: #d14343;
}

.section-note[hidden] {
  display: none;
}

.section-divider {
  height: 8px;
  margin: 22px -16px 20px;
  background: var(--section);
}

.field-list {
  gap: 20px;
}

.field {
  gap: 8px;
  min-width: 0;
}

.field-label {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  line-height: 1.35;
  font-weight: 600;
}

.control-button {
  min-height: 41px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  color: var(--muted-soft);
  font-size: 15px;
  line-height: 1.5;
  text-align: left;
}

.control-button.has-value {
  color: var(--text);
}

.control-button::after {
  content: '';
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid #646a80;
  border-radius: 2px;
  flex: 0 0 auto;
  margin-left: 12px;
}

.helper-note,
.auto-note {
  margin: 0;
  color: var(--secondary);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 400;
}

.date-count-note[hidden],
.season-area[hidden] {
  display: none;
}

.time-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.time-row.is-rule {
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
}

.inline-text {
  color: var(--text);
  font-size: 14px;
  line-height: 1;
  white-space: nowrap;
}

.select-wrap {
  display: block;
  min-width: 0;
  position: relative;
}

.select-wrap select[data-time-select] {
  pointer-events: none;
}

.fee-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.fee-mini-field {
  display: grid;
  gap: 8px;
}

.mini-label {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.2;
  font-weight: 400;
}

.money-input {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 41px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  color: var(--text);
  font-size: 15px;
  line-height: 1.25;
}

.money-input input {
  min-height: 0;
  border: 0;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  font-size: 15px;
}

.fee-card {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
}

.fee-check-row {
  min-height: 41px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid var(--line-soft);
  color: var(--text);
  font-size: 13px;
  line-height: 1.25;
  font-weight: 400;
  cursor: pointer;
}

.fee-check {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: 1.5px solid #1bc4bf;
  border-radius: 4px;
  background: #1bc4bf;
  color: #fff;
  flex: 0 0 auto;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

#season-include-ac:not(:checked) + .fee-check {
  border-color: var(--line-soft);
  background: #fff;
  color: transparent;
}

.fee-check svg {
  width: 14px;
  height: 14px;
}

.fee-input-row {
  min-height: 41px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  color: var(--text);
  font-size: 15px;
  line-height: 1.25;
  white-space: nowrap;
}

.fee-input-row input {
  min-height: 0;
  border: 0;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  font-size: 15px;
}

#season-fee {
  width: calc((var(--season-fee-digits, 1) * 1ch) + 2px);
  flex: 0 0 auto;
}

.fee-unit {
  margin-left: 0;
}

.fee-input-row input:placeholder-shown + .fee-unit {
  display: none;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.switch {
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: #dfe3ee;
  padding: 2px;
  transition: background-color 0.2s ease;
  flex: 0 0 auto;
}

.switch::after {
  content: '';
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}

.switch.is-on {
  background: var(--secondary);
}

.switch.is-on::after {
  transform: translateX(16px);
}

.switch.is-disabled {
  cursor: default;
  opacity: 0.5;
}

.season-fields {
  overflow: hidden;
  transition:
    max-height 0.24s ease,
    opacity 0.2s ease,
    margin-top 0.2s ease;
  max-height: 900px;
  opacity: 1;
}

.season-fields.is-collapsed {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
}

.season-area.is-collapsed {
  gap: 0;
}

.season-area.is-collapsed + .section-divider {
  margin-top: 20px;
}

.choice-stack {
  display: grid;
  gap: 12px;
}

.choice-card {
  min-height: 80px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  padding: 14px;
}

.choice-card.is-condensed {
  align-items: center;
  min-height: 66px;
}

.choice-card.is-active {
  border-color: var(--primary);
}

.radio-mark {
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--line-soft);
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  margin-top: 2px;
}

.choice-card.is-active .radio-mark {
  border-color: var(--primary);
}

.choice-card.is-active .radio-mark::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
}

.choice-summary,
.choice-content {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.choice-title {
  color: var(--text);
  font-size: 15px;
  line-height: 1.35;
  font-weight: 600;
}

.choice-copy {
  color: var(--muted-soft);
  font-size: 13px;
  line-height: 1.3;
  font-weight: 400;
}

.choice-rule {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  color: var(--text);
  font-size: 14px;
  line-height: 1.35;
}

.time-row.is-rule select,
.choice-rule select {
  font-size: 15px;
}

.choice-rule.is-date-time {
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

#date-picker-button,
#season-capacity,
#season-open-date-button,
#season-open-time,
#season-close-date-button,
#season-close-time,
.money-input,
.money-input input {
  font-size: 15px;
}

.choice-card.is-condensed .choice-rule {
  display: none;
}

.cta-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 8;
  padding: 46px 16px 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #fff 38%, #fff 100%);
  pointer-events: none;
}

.submit-button {
  width: 100%;
  min-height: 54px;
  border-radius: 10px;
  background: var(--secondary);
  color: #fff;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
  pointer-events: auto;
}

.calendar-overlay,
.time-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: none;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.32);
}

.calendar-overlay.is-open,
.time-overlay.is-open {
  display: flex;
}

.calendar-sheet,
.time-sheet {
  width: 100%;
  padding: 16px;
  border-radius: 18px 18px 0 0;
  background: #fff;
}

.calendar-header,
.time-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.calendar-title,
.time-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.36;
  font-weight: 600;
}

.calendar-nav,
.time-close {
  min-width: 40px;
  min-height: 36px;
  display: grid;
  place-items: center;
  color: var(--primary);
}

.time-close {
  font-size: 15px;
  font-weight: 500;
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-weekdays {
  margin-bottom: 6px;
  color: var(--muted-soft);
  font-size: 12px;
  text-align: center;
}

.calendar-day {
  min-height: 36px;
  border-radius: 9px;
  color: var(--text);
  font-size: 14px;
}

.calendar-day.is-muted {
  color: #bdc1d1;
}

.calendar-day.is-selected {
  background: var(--primary);
  color: #fff;
}

.calendar-actions,
.time-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.calendar-action,
.time-action {
  min-height: 44px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
}

.calendar-action.is-muted,
.time-action.is-muted {
  background: #f4f6fa;
  color: var(--muted);
}

.calendar-action.is-primary,
.time-action.is-primary {
  background: var(--primary);
  color: #fff;
}

.time-wheels {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  padding: 8px 0;
}

.time-wheels::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 44px;
  border-radius: 10px;
  background: #f4f6fa;
  transform: translateY(-50%);
  pointer-events: none;
}

.time-wheel-column {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 4px;
}

.time-wheel {
  height: 220px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.time-wheel::-webkit-scrollbar {
  display: none;
}

.time-wheel::before,
.time-wheel::after {
  content: '';
  display: block;
  height: 88px;
}

.time-wheel-option {
  min-height: 44px;
  width: 100%;
  display: grid;
  place-items: center;
  scroll-snap-align: center;
  color: #9aa0b8;
  font-size: 22px;
  line-height: 1;
  font-weight: 400;
}

.time-wheel-option.is-selected {
  color: var(--text);
  font-size: 26px;
  font-weight: 500;
}

.time-wheel-arrow {
  display: none;
  min-height: 28px;
  place-items: center;
  color: var(--muted);
  border-radius: 8px;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.time-wheel-arrow svg {
  width: 18px;
  height: 18px;
}

.time-wheel-arrow:hover {
  background: #f4f6fa;
  color: var(--text);
}

.success-dialog-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.24s ease;
}

.success-dialog-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

.success-dialog {
  width: min(100%, 318px);
  border-radius: 16px;
  background: #fff;
  padding: 28px 22px 22px;
  box-shadow: 0 22px 52px rgba(16, 24, 64, 0.2);
  text-align: center;
  transform: translateY(10px) scale(0.98);
  transition: transform 0.24s ease;
}

.success-dialog-overlay.is-open .success-dialog {
  transform: translateY(0) scale(1);
}

.success-dialog-title {
  margin: 0;
  color: var(--text);
  font-size: 20px;
  line-height: 1.4;
  font-weight: 600;
}

.success-dialog-copy {
  margin: 12px 0 24px;
  color: #474d66;
  font-size: 15px;
  line-height: 1.5;
  font-weight: 400;
}

.success-dialog-button {
  width: 100%;
  min-height: 48px;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
}

@media (hover: hover) and (pointer: fine) {
  .time-wheel-arrow {
    display: grid;
  }

  .time-wheel {
    height: 176px;
  }

  .time-wheel::before,
  .time-wheel::after {
    height: 66px;
  }
}

@media (max-width: 500px) {
  body {
    padding: 0;
    display: block;
    background: #fff;
  }

  input,
  select,
  .money-input input,
  .fee-input-row input {
    font-size: 15px;
  }

  #season-single-fee,
  #pickup-single-fee,
  #ac-fee,
  #season-capacity,
  #season-open-date-button,
  #season-open-time,
  #season-close-date-button,
  #season-close-time,
  .money-input,
  .money-input input {
    font-size: 15px;
  }

  .time-row.is-rule select,
  .choice-rule select {
    font-size: 15px;
  }

  .app-shell {
    width: 100%;
    height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }
}

input.is-error,
select.is-error,
.control-button.is-error,
.money-input.is-error {
  border-color: #d14343;
  box-shadow: 0 0 0 3px rgba(209, 67, 67, 0.12);
}
</style>
