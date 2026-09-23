<script setup>
import { ref } from 'vue'
import AccessibleDialog from '~/components/AccessibleDialog.vue'
import { INPUT_LIMITS } from '~/config/inputLimits'

defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  isSeasonLeaveMode: {
    type: Boolean,
    required: true,
  },
  signupState: {
    type: Object,
    required: true,
  },
  signupTotal: {
    type: Number,
    required: true,
  },
  isRegistrationOpen: {
    type: Boolean,
    required: true,
  },
  isSubmitting: {
    type: Boolean,
    required: true,
  },
  isSignupChanged: {
    type: Boolean,
    required: true,
  },
  registrationCountdown: {
    type: String,
    default: null,
  },
  showGuestValidation: {
    type: Boolean,
    required: true,
  },
  isAdmin: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['close', 'adjust-count', 'submit'])

const GENDER_OPTIONS = [
  { value: '', label: '性別', disabled: true },
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
]

const closeButton = ref(null)
const confirmButton = ref(null)

function isGuestNameTooLong(name) {
  return name.length > INPUT_LIMITS.guestName
}

defineExpose({
  focusClose: () => closeButton.value?.focus({ preventScroll: true }),
  focusConfirm: () => confirmButton.value?.focus({ preventScroll: true }),
})
</script>

<template>
  <AccessibleDialog
    :open="open"
    :title="isSeasonLeaveMode ? '季打請假或臨打報名' : '報名此球局'"
    overlay-class="signup-overlay phone-container modal-frame"
    content-class="signup-sheet"
    @close="emit('close')"
  >
    <div class="signup-sheet-header">
      <h2 class="signup-sheet-title" id="signup-sheet-title">{{ isSeasonLeaveMode ? '季打請假或臨打報名' : '報名此球局' }}</h2>
      <span v-if="!isSeasonLeaveMode" class="prefill-tag">可預填</span>
      <button ref="closeButton" class="signup-close" type="button" aria-label="關閉報名表" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 7L17 17M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    <div class="signup-sheet-scroll">
      <div class="signup-controls">
        <div class="signup-field-card">
          <div class="signup-field-row">
            <div class="signup-field-label">我</div>
            <div class="signup-stepper">
              <button class="stepper-btn" type="button" :disabled="signupState.self <= 0" aria-label="減少我的報名人數" @click="emit('adjust-count', 'self', -1)">
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </button>
              <output class="stepper-value">{{ signupState.self }}</output>
              <button class="stepper-btn" type="button" :disabled="signupState.self >= 1" aria-label="增加我的報名人數" @click="emit('adjust-count', 'self', 1)">
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M7 3V11M3 7H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="signup-field-card is-stack">
          <div class="signup-field-row">
            <div class="signup-field-label">群外</div>
            <div class="signup-stepper">
              <button class="stepper-btn" type="button" :disabled="signupState.guest <= 0" aria-label="減少群外報名人數" @click="emit('adjust-count', 'guest', -1)">
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </button>
              <output class="stepper-value">{{ signupState.guest }}</output>
              <button class="stepper-btn" type="button" :disabled="!isAdmin && signupState.guest >= 2" aria-label="增加群外報名人數" @click="emit('adjust-count', 'guest', 1)">
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M7 3V11M3 7H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <div class="guest-fields" aria-live="polite">
            <div v-for="(guest, index) in signupState.guests" :key="index" class="guest-row">
              <div class="guest-name-field">
                <input
                  v-model="guest.name"
                  class="guest-input"
                  :class="{ 'is-error': isGuestNameTooLong(guest.name) }"
                  type="text"
                  :name="`guest-name-${index + 1}`"
                  placeholder="群外朋友姓名"
                  :maxlength="INPUT_LIMITS.guestName"
                  :aria-label="`第 ${index + 1} 位群外朋友姓名`"
                  :aria-describedby="`guest-name-limit-${index + 1}`"
                  :aria-invalid="isGuestNameTooLong(guest.name)"
                />
                <p v-if="isGuestNameTooLong(guest.name)" :id="`guest-name-limit-${index + 1}`" class="guest-name-error" role="alert">姓名最多 {{ INPUT_LIMITS.guestName }} 字</p>
                <p v-else :id="`guest-name-limit-${index + 1}`" class="guest-name-limit">{{ guest.name.length }} / {{ INPUT_LIMITS.guestName }}</p>
              </div>
              <select
                v-model="guest.gender"
                class="guest-select"
                :class="{ 'is-error': showGuestValidation && !guest.gender }"
                :name="`guest-gender-${index + 1}`"
                required
                :aria-label="`第 ${index + 1} 位群外朋友性別`"
              >
                <option v-for="option in GENDER_OPTIONS" :key="option.value" :value="option.value" :disabled="option.disabled">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="signup-sheet-footer">
      <p class="signup-count">共報名 {{ signupTotal }} 位</p>
      <button
        ref="confirmButton"
        class="confirm-signup"
        type="button"
        :disabled="!(isRegistrationOpen || (isSeasonLeaveMode && signupState.guest === 0)) || isSubmitting || !isSignupChanged"
        @click="emit('submit')"
      >
        確認報名
      </button>
      <p v-if="registrationCountdown && !(isSeasonLeaveMode && signupState.guest === 0)" class="signup-countdown">{{ registrationCountdown }}</p>
      <p v-else class="signup-note">送出不代表報名成功，請以名單為準</p>
    </div>
  </AccessibleDialog>
</template>

<style>
.signup-overlay {
  position: fixed;
  overflow: hidden;
  left: 0;
  right: 0;
  margin: auto;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s ease;
}

.signup-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

.signup-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: min(422px, calc(100% - 48px));
  border-radius: 16px 16px 0 0;
  background: #fff;
  color: #101840;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateY(100%);
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.signup-overlay.is-open .signup-sheet {
  transform: translateY(0);
}

.signup-sheet-header {
  flex: 0 0 auto;
  min-height: 74px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 30px 20px 16px;
}

.signup-sheet-title {
  margin: 0;
  font-size: 20px;
  line-height: 1.4;
  font-weight: 600;
  color: #101840;
  white-space: nowrap;
}

.prefill-tag {
  margin-top: 2px;
  padding: 4px 8px;
  border-radius: 6px;
  background: #f7f8fe;
  color: #5768ff;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
  white-space: nowrap;
}

.prefill-tag.is-leave {
  background: rgba(255, 230, 190, 0.85);
  color: #c87416;
}

.signup-close {
  width: 24px;
  height: 24px;
  margin-left: auto;
  display: grid;
  place-items: center;
  color: #474d66;
  flex: 0 0 auto;
}

.signup-close svg {
  width: 24px;
  height: 24px;
}

.signup-sheet-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 20px 18px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.signup-sheet-scroll::-webkit-scrollbar {
  display: none;
}

.signup-controls {
  display: grid;
  gap: 12px;
}

.signup-field-card {
  width: 100%;
  border: 1px solid #edeff5;
  border-radius: 12px;
  background: #fff;
  padding: 13px 17px;
}

.signup-field-card.is-stack {
  display: grid;
  gap: 12px;
}

.signup-field-row {
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.signup-field-label {
  min-width: 0;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 500;
  color: #101840;
}

.signup-stepper {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 0 0 auto;
}

.stepper-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #5768ff;
  color: #fff;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.stepper-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.stepper-btn:disabled {
  background: #d8dae5;
  cursor: default;
}

.stepper-btn svg {
  width: 14px;
  height: 14px;
}

.stepper-value {
  width: 12px;
  font-size: 20px;
  line-height: 1;
  font-weight: 700;
  text-align: center;
  color: #393939;
  font-variant-numeric: tabular-nums;
}

.guest-fields {
  display: grid;
  gap: 9px;
}

.guest-fields:empty {
  display: none;
}

.guest-row {
  display: grid;
  align-items: flex-start;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 9px;
}

.guest-name-field {
  display: grid;
  gap: 4px;
}

.guest-input,
.guest-select {
  width: 100%;
  min-height: 42px;
  border: 1px solid rgba(86, 103, 137, 0.2);
  border-radius: 8px;
  background: #fff;
  color: #101840;
  font: inherit;
  font-size: 16px;
  line-height: 1.5;
  padding: 10px;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.guest-input:focus,
.guest-select:focus {
  border-color: rgba(87, 104, 255, 0.72);
  box-shadow: 0 0 0 3px rgba(87, 104, 255, 0.12);
}

.guest-select.is-error {
  border-color: #d14343;
  box-shadow: 0 0 0 3px rgba(209, 67, 67, 0.12);
}

.guest-input.is-error {
  border-color: #d14343;
  box-shadow: 0 0 0 3px rgba(209, 67, 67, 0.12);
}

.guest-name-limit,
.guest-name-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
}

.guest-name-limit {
  color: #8f95b2;
  text-align: right;
}

.guest-name-error {
  color: #d14343;
}

.guest-select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, #696f8c 50%), linear-gradient(135deg, #696f8c 50%, transparent 50%);
  background-position:
    calc(100% - 18px) 18px,
    calc(100% - 13px) 18px;
  background-size:
    5px 5px,
    5px 5px;
  background-repeat: no-repeat;
  padding-right: 32px;
}

.guest-input::placeholder,
.guest-select:invalid {
  color: #8f95b2;
}

.signup-count {
  margin: 0 0 13px;
  color: #5768ff;
  font-size: 15px;
  line-height: 1.4;
  font-weight: 500;
  text-align: center;
}

.signup-sheet-footer {
  flex: 0 0 auto;
  padding: 0 22px 21px;
  background: #fff;
}

.confirm-signup {
  width: 100%;
  min-height: 48px;
  border-radius: 10px;
  background: #5768ff;
  color: #fff;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
}

.confirm-signup:disabled {
  background: #d8dae5;
  cursor: default;
}

.signup-note {
  margin: 13px 0 0;
  color: #696f8c;
  font-size: 13px;
  line-height: 1.25;
  text-align: center;
}

.signup-countdown {
  margin: 13px 0 0;
  color: #8f95b2;
  font-size: 13px;
  line-height: 1.25;
  font-weight: 400;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
