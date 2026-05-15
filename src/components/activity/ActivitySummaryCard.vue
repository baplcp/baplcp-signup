<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

defineProps({
  date: {
    type: String,
    required: true,
  },
  weekday: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  statusLabel: {
    type: String,
    required: true,
  },
  statusValue: {
    type: String,
    required: true,
  },
  statusTone: {
    type: String,
    default: 'default',
  },
  feeAmount: {
    type: [Number, String],
    required: true,
  },
  feeState: {
    type: String,
    default: '',
  },
  feeAriaLabel: {
    type: String,
    required: true,
  },
  feeStateTone: {
    type: String,
    default: 'default',
  },
  shadowTone: {
    type: String,
    default: 'primary',
  },
  vacancyLabel: {
    type: String,
    default: '',
  },
  vacancyValue: {
    type: [Number, String],
    default: '',
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  acEnabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:acEnabled'])

const showDropdown = ref(false)
const acToggleRef = ref(null)
const dropdownStyle = ref({})

function updateDropdownPosition() {
  if (!acToggleRef.value) return
  const rect = acToggleRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    zIndex: '9999',
  }
}

async function toggleDropdown() {
  if (showDropdown.value) {
    showDropdown.value = false
    return
  }
  showDropdown.value = true
  await nextTick()
  updateDropdownPosition()
}

function selectAc(value) {
  emit('update:acEnabled', value)
  showDropdown.value = false
}

function handleDocumentClick(e) {
  if (acToggleRef.value && !acToggleRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', handleDocumentClick))
onUnmounted(() => document.removeEventListener('click', handleDocumentClick))
</script>

<template>
  <section class="summary-card activity-summary-card" :class="`summary-card--${shadowTone}`" aria-label="活動摘要">
    <div class="summary-main activity-summary-main">
      <div v-if="vacancyLabel" class="summary-vacancy">
        <p class="summary-vacancy-label">{{ vacancyLabel }}</p>
        <p class="summary-vacancy-value">{{ vacancyValue }}</p>
      </div>
      <div class="summary-info activity-summary-info">
        <p class="summary-time activity-summary-time">
          <span class="summary-date activity-summary-date"
            >{{ date }}<span class="summary-weekday activity-summary-weekday">（{{ weekday }}）</span></span
          >
          <span class="summary-separator activity-summary-separator">|</span>
          <span>{{ time }}</span>
        </p>
        <p class="summary-location activity-summary-location">{{ location }}</p>
      </div>
    </div>
    <div class="summary-status activity-summary-status">
      <p class="summary-status-text activity-summary-status-text">
        {{ statusLabel }}：<span class="summary-status-value" :class="`summary-status-value--${statusTone}`">{{ statusValue }}</span>
      </p>
      <div class="summary-fee activity-summary-fee" :aria-label="feeAriaLabel">
        <div v-if="isAdmin" class="ac-control">
          <img class="summary-fee-money activity-summary-fee-money" src="/images/money-icon.png" alt="" aria-hidden="true" />
          <button ref="acToggleRef" class="ac-toggle-btn" type="button" :aria-label="acEnabled ? '已開冷氣，點擊更改' : '未開冷氣，點擊更改'" @click.stop="toggleDropdown">
            <svg class="ac-chevron" :class="{ 'is-open': showDropdown }" viewBox="0 0 12 8" fill="none" aria-hidden="true">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <Teleport to="body">
            <div v-if="showDropdown" class="ac-dropdown" :style="dropdownStyle" role="menu">
              <button class="ac-option" :class="{ 'is-selected': acEnabled }" type="button" role="menuitem" @click="selectAc(true)">開冷氣</button>
              <button class="ac-option" :class="{ 'is-selected': !acEnabled }" type="button" role="menuitem" @click="selectAc(false)">沒開冷氣</button>
            </div>
          </Teleport>
        </div>
        <img v-else class="summary-fee-money activity-summary-fee-money" src="/images/money-icon.png" alt="" aria-hidden="true" />
        <img v-if="acEnabled" class="summary-fee-air activity-summary-fee-air" src="/images/airconditioner-icon.png" alt="" aria-hidden="true" />
        <span class="summary-fee-amount activity-summary-fee-amount">${{ feeAmount }}</span>
        <span v-if="feeState" class="summary-fee-state activity-summary-fee-state" :class="`summary-fee-state--${feeStateTone}`">{{ feeState }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-card--primary {
  box-shadow: var(--shadow-primary-card);
}

.summary-card--muted {
  box-shadow: 2px 2px 28px rgba(143, 149, 178, 0.24);
}

.summary-vacancy {
  width: 70px;
  min-height: 70px;
  flex: 0 0 auto;
  border-radius: 9px;
  background: rgba(220, 245, 245, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  text-align: center;
}

.summary-vacancy-label {
  margin: 0;
  font-size: 13px;
  line-height: 1.25;
  font-weight: 400;
  color: #474d66;
}

.summary-vacancy-value {
  margin: 0;
  font-size: 32px;
  line-height: 1.25;
  font-weight: 700;
  color: #17acba;
}

.summary-status-value {
  font-weight: 400;
}

.summary-status-value--default {
  color: var(--muted-soft);
}

.summary-status-value--success {
  color: var(--success-500);
}

.summary-fee-state--success {
  color: var(--success-500);
}

.ac-control {
  display: flex;
  align-items: center;
  margin-right: -10px;
}

.ac-control .summary-fee-money {
  margin-right: 0;
}

.ac-toggle-btn {
  display: flex;
  align-items: center;
  padding: 4px 3px;
  color: #8f95b2;
}

.ac-chevron {
  width: 10px;
  height: 7px;
  transition: transform 0.2s ease;
  flex: 0 0 auto;
}

.ac-chevron.is-open {
  transform: rotate(180deg);
}
</style>

<style>
.ac-dropdown {
  min-width: 110px;
  background: #fff;
  border: 1px solid #e6e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(16, 24, 67, 0.14);
  overflow: hidden;
}

.ac-option {
  display: block;
  width: 100%;
  padding: 10px 16px;
  text-align: left;
  font-size: 14px;
  line-height: 1.4;
  color: #474d66;
  font-family: inherit;
  border: 0;
  background: none;
  cursor: pointer;
}

.ac-option + .ac-option {
  border-top: 1px solid #f4f6fa;
}

.ac-option.is-selected {
  color: #5768ff;
  font-weight: 600;
  background: #eef1ff;
}

.ac-option:active {
  background: #f4f6fa;
}
</style>
