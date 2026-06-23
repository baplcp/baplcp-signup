<script setup>
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  modelValue: {
    type: String,
    default: '',
  },
  hourOnly: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'commit'])

const hours = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))
const minutesHourOnly = ['00']
const periods = ['AM', 'PM']

const pickerValue = reactive(from24Hour(props.modelValue))
const timeWheelRefs = {
  hour: ref(null),
  minute: ref(null),
  period: ref(null),
}
const scrollTimers = new Map()

watch(
  () => props.open,
  open => {
    if (!open) return
    const parsed = from24Hour(props.modelValue)
    if (props.hourOnly) parsed.minute = '00'
    Object.assign(pickerValue, parsed)
    nextTick(() => {
      scrollToTimeValue('hour', pickerValue.hour)
      scrollToTimeValue('minute', pickerValue.minute)
      scrollToTimeValue('period', pickerValue.period)
    })
  }
)

onBeforeUnmount(() => {
  scrollTimers.forEach(timer => clearTimeout(timer))
})

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

function commitTimePicker() {
  emit('commit', to24Hour(pickerValue.hour, pickerValue.minute, pickerValue.period))
}

function stepTime(key, direction, values) {
  let index = values.indexOf(pickerValue[key]) + Number(direction)
  if (index < 0) index = values.length - 1
  if (index >= values.length) index = 0
  pickerValue[key] = values[index]
  scrollToTimeValue(key, pickerValue[key], 'smooth')
}

function selectTimeValue(key, value) {
  pickerValue[key] = value
  scrollToTimeValue(key, value, 'smooth')
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

    if (closest) pickerValue[key] = values[closest.index]
    scrollTimers.delete(wheel)
  }, 90)

  scrollTimers.set(wheel, timer)
}
</script>

<template>
  <div class="time-overlay phone-container modal-frame" :class="{ 'is-open': open }" :aria-hidden="String(!open)" @click.self="emit('close')">
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
            <button
              v-for="hour in hours"
              :key="`hour-${hour}`"
              class="time-wheel-option"
              :class="{ 'is-selected': pickerValue.hour === hour }"
              type="button"
              :data-value="hour"
              @click="selectTimeValue('hour', hour)"
            >
              {{ hour }}
            </button>
          </div>
          <button class="time-wheel-arrow" type="button" aria-label="小時增加" @click="stepTime('hour', 1, hours)">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div class="time-wheel-column">
          <button class="time-wheel-arrow" type="button" aria-label="分鐘減少" @click="stepTime('minute', -1, hourOnly ? minutesHourOnly : minutes)">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 14L12 9L17 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div :ref="el => (timeWheelRefs.minute.value = el)" class="time-wheel" aria-label="分鐘" @scroll.passive="onTimeWheelScroll($event, 'minute', hourOnly ? minutesHourOnly : minutes)">
            <button
              v-for="minute in (hourOnly ? minutesHourOnly : minutes)"
              :key="`minute-${minute}`"
              class="time-wheel-option"
              :class="{ 'is-selected': pickerValue.minute === minute }"
              type="button"
              :data-value="minute"
              @click="selectTimeValue('minute', minute)"
            >
              {{ minute }}
            </button>
          </div>
          <button class="time-wheel-arrow" type="button" aria-label="分鐘增加" @click="stepTime('minute', 1, hourOnly ? minutesHourOnly : minutes)">
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
            <button
              v-for="period in periods"
              :key="`period-${period}`"
              class="time-wheel-option"
              :class="{ 'is-selected': pickerValue.period === period }"
              type="button"
              :data-value="period"
              @click="selectTimeValue('period', period)"
            >
              {{ period }}
            </button>
          </div>
          <button class="time-wheel-arrow" type="button" aria-label="上午下午切換" @click="stepTime('period', 1, periods)">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div class="time-actions">
        <button class="time-action is-muted" type="button" @click="emit('close')">取消</button>
        <button class="time-action is-primary" type="button" @click="commitTimePicker">完成</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.time-overlay {
  position: fixed;
  z-index: 20;
  overflow: hidden;
  margin: auto;
  display: none;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.32);
}

.time-overlay.is-open {
  display: flex;
}

.time-sheet {
  width: 100%;
  padding: 16px;
  border-radius: 18px 18px 0 0;
  background: #fff;
}

.time-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.time-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.36;
  font-weight: 600;
}

.time-close {
  min-width: 40px;
  min-height: 36px;
  display: grid;
  place-items: center;
  color: var(--primary-600);
  font-size: 15px;
  font-weight: 500;
}

.time-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.time-action {
  min-height: 44px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
}

.time-action.is-muted {
  background: #f4f6fa;
  color: var(--muted);
}

.time-action.is-primary {
  background: var(--primary-600);
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
</style>
