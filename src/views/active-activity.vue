<script setup>
import { computed, nextTick, reactive, ref } from 'vue'

const APP_VERSION = 'v2026.04.18-active-drawer-04'
const MEMBER_LIST = [
  { name: '莊則元', badge: '莊', image: import.meta.env.BASE_URL + '/images/profile01.png' },
  { name: '施政維', badge: '施', image: import.meta.env.BASE_URL + '/images/profile02.png' },
  { name: '莊宸豪', badge: '莊', image: import.meta.env.BASE_URL + '/images/profile03.png' },
  { name: '蔚', badge: '蔚', image: import.meta.env.BASE_URL + '/images/profile04.png' },
  { name: '乃瑄', badge: '乃', image: import.meta.env.BASE_URL + '/images/profile05.png' },
  { name: '莊辰豪', badge: '莊', image: import.meta.env.BASE_URL + '/images/profile06.png' },
  { name: '黃品諭', badge: '黃', image: import.meta.env.BASE_URL + '/images/profile07.png', status: '候補' },
  { name: '黃品翰', badge: '黃', color: 'linear-gradient(135deg, #b59dc8 0%, #8468a0 100%)', status: '候補' },
]
const SEGMENT_TABS = ['全部', '臨打', '季打']
const GENDER_OPTIONS = [
  { value: '', label: '性別', disabled: true },
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
  { value: 'other', label: '其他' },
]

const activeSegment = ref(SEGMENT_TABS[0])
const signupOpen = ref(false)
const heroCtaButton = ref(null)
const signupCloseButton = ref(null)
const confirmSignupButton = ref(null)
const successDialogButton = ref(null)
const signupState = reactive({
  self: 0,
  guest: 0,
  guests: [],
})
const submittedSignupState = ref(cloneSignupState(signupState))
const successDialog = reactive({
  open: false,
  title: '報名已送出',
  copy: '已送出報名 0 位，請稍候確認名單是否成功加入',
  buttonText: '確認',
})

const signupTotal = computed(() => signupState.self + signupState.guest)
const submittedTotal = computed(() => submittedSignupState.value.self + submittedSignupState.value.guest)
const hasSubmittedSignup = computed(() => submittedTotal.value > 0)
const summaryFee = computed(() => (hasSubmittedSignup.value ? submittedTotal.value * 255 : 255))
const summaryStatusText = computed(() => (hasSubmittedSignup.value ? `已成功報名 ${submittedTotal.value} 位` : '無報名'))
const summaryFeeLabel = computed(() => (hasSubmittedSignup.value ? `費用 ${summaryFee.value} 元，未付` : '費用 255 元'))
const heroCtaText = computed(() => (hasSubmittedSignup.value ? '管理報名' : '我要報名'))
const isSignupChanged = computed(() => {
  if (signupState.self !== submittedSignupState.value.self || signupState.guest !== submittedSignupState.value.guest) {
    return true
  }

  for (let index = 0; index < signupState.guest; index += 1) {
    const currentGuest = signupState.guests[index] || { name: '', gender: '' }
    const submittedGuest = submittedSignupState.value.guests[index] || { name: '', gender: '' }

    if ((currentGuest.name || '') !== (submittedGuest.name || '') || (currentGuest.gender || '') !== (submittedGuest.gender || '')) {
      return true
    }
  }

  return false
})

function cloneSignupState(state) {
  return {
    self: state.self,
    guest: state.guest,
    guests: state.guests.map(guest => ({
      name: guest && guest.name ? guest.name : '',
      gender: guest && guest.gender ? guest.gender : '',
    })),
  }
}

function focusElement(target) {
  nextTick(() => {
    target.value?.focus({ preventScroll: true })
  })
}

function setSignupOpen(isOpen, options = {}) {
  const { restoreFocus = true } = options
  signupOpen.value = isOpen

  if (isOpen) {
    focusElement(signupCloseButton)
  } else if (restoreFocus) {
    focusElement(heroCtaButton)
  }
}

function setSuccessDialogOpen(isOpen, options = {}) {
  if (options.title) successDialog.title = options.title
  if (options.copy) successDialog.copy = options.copy
  if (options.buttonText) successDialog.buttonText = options.buttonText

  successDialog.open = isOpen

  if (isOpen) {
    focusElement(successDialogButton)
  } else if (signupOpen.value) {
    focusElement(confirmSignupButton)
  } else {
    focusElement(heroCtaButton)
  }
}

function setSegmentTab(tab) {
  activeSegment.value = tab
}

function adjustSignupCount(type, direction) {
  const max = type === 'self' ? 1 : 6
  signupState[type] = Math.max(0, Math.min(max, signupState[type] + direction))

  if (type !== 'guest') return

  while (signupState.guests.length < signupState.guest) {
    signupState.guests.push({ name: '', gender: '' })
  }

  signupState.guests.splice(signupState.guest)
}

function submitSignup() {
  if (!isSignupChanged.value) return

  const total = signupTotal.value
  const previousTotal = submittedTotal.value
  const isUpdatingExistingSignup = previousTotal > 0

  if (total <= 0 && previousTotal <= 0) {
    setSuccessDialogOpen(true, {
      title: '還沒有選擇人數',
      copy: '目前沒有任何人被加入報名，請先選擇「我」或「群外」人數後再送出。',
      buttonText: '回去選人',
    })
    return
  }

  submittedSignupState.value = cloneSignupState(signupState)
  setSignupOpen(false, { restoreFocus: false })
  setSuccessDialogOpen(true, {
    title: isUpdatingExistingSignup || total <= 0 ? '報名已更新' : '報名已送出',
    copy: total > 0 ? `${isUpdatingExistingSignup ? '已更新報名 ' : '已送出報名 '}${total} 位，請稍候確認名單是否成功加入` : '已更新為無報名，請稍候確認名單是否同步完成',
    buttonText: '確認',
  })
}

function handleEscape() {
  if (successDialog.open) {
    setSuccessDialogOpen(false)
    return
  }

  if (signupOpen.value) {
    setSignupOpen(false)
  }
}
</script>

<template>
  <main class="active-activity-page" :class="{ 'signup-open': signupOpen }" @keydown.esc="handleEscape">
    <div>
      <div class="scroll-content">
        <section class="hero">
          <img class="hero-cat" src="/images/cat-hide.png" alt="" aria-hidden="true" />
          <div class="hero-layout">
            <div class="hero-copy">
              <h1>最新球局報名</h1>
            </div>
          </div>
        </section>

        <section class="summary-card" aria-label="活動摘要">
          <div class="summary-main">
            <div class="summary-vacancy">
              <p class="summary-vacancy-label">臨打缺</p>
              <p class="summary-vacancy-value">2</p>
            </div>
            <div class="summary-info">
              <p class="summary-time">
                <span class="summary-date">12.31<span class="summary-weekday">（日）</span></span>
                <span class="summary-separator">|</span>
                <span>12:20-15:20</span>
              </p>
              <p class="summary-location">板橋柏吉倫排球場</p>
            </div>
          </div>
          <div class="summary-status">
            <p class="summary-status-text">
              狀態：<span class="summary-status-value" :class="{ 'is-success': hasSubmittedSignup }">{{ summaryStatusText }}</span>
            </p>
            <div class="summary-fee" :aria-label="summaryFeeLabel">
              <img class="summary-fee-money" src="/images/money-icon.png" alt="" aria-hidden="true" />
              <img class="summary-fee-air" src="/images/airconditioner-icon.png" alt="" aria-hidden="true" />
              <span class="summary-fee-amount">${{ summaryFee }}</span>
              <span v-if="hasSubmittedSignup" class="summary-fee-state">未付</span>
            </div>
          </div>
        </section>

        <section class="content">
          <div class="segment-tabs" role="tablist" aria-label="名單分類">
            <button
              v-for="tab in SEGMENT_TABS"
              :key="tab"
              class="segment-tab"
              :class="{ 'is-active': activeSegment === tab }"
              type="button"
              role="tab"
              :aria-selected="String(activeSegment === tab)"
              @click="setSegmentTab(tab)"
            >
              {{ tab }}
            </button>
          </div>
          <div class="list">
            <div v-for="(member, index) in MEMBER_LIST" :key="`${member.name}-${index}`" class="row">
              <div class="rank">{{ index + 1 }}</div>
              <div class="avatar" :style="member.image ? undefined : { background: member.color }">
                <img v-if="member.image" :src="member.image" alt="" />
                <template v-else>{{ member.badge }}</template>
              </div>
              <div class="name">{{ member.name }}</div>
              <div v-if="member.status" class="status-tag">{{ member.status }}</div>
            </div>
          </div>
          <div class="version">{{ APP_VERSION }}</div>
        </section>
      </div>
    </div>

    <div class="footer-bar">
      <div class="footer-fade"></div>
      <button ref="heroCtaButton" class="cta" type="button" @click="setSignupOpen(true)">{{ heroCtaText }}</button>
    </div>

    <div class="signup-overlay phone-container top-0 bottom-0 md:top-[24px] md:bottom-[24px] md:rounded-3xl" :class="{ 'is-open': signupOpen }" :aria-hidden="String(!signupOpen)" :inert="!signupOpen">
      <button class="signup-backdrop" type="button" aria-label="關閉報名表" @click="setSignupOpen(false)"></button>
      <section class="signup-sheet" role="dialog" aria-modal="true" aria-labelledby="signup-sheet-title">
        <div class="signup-sheet-header">
          <h2 class="signup-sheet-title" id="signup-sheet-title">報名此球局</h2>
          <span class="prefill-tag">可預填</span>
          <button ref="signupCloseButton" class="signup-close" type="button" aria-label="關閉報名表" @click="setSignupOpen(false)">
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
                  <button class="stepper-btn" type="button" :disabled="signupState.self <= 0" aria-label="減少我的報名人數" @click="adjustSignupCount('self', -1)">
                    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M3 7H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  </button>
                  <output class="stepper-value">{{ signupState.self }}</output>
                  <button class="stepper-btn" type="button" :disabled="signupState.self >= 1" aria-label="增加我的報名人數" @click="adjustSignupCount('self', 1)">
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
                  <button class="stepper-btn" type="button" :disabled="signupState.guest <= 0" aria-label="減少群外報名人數" @click="adjustSignupCount('guest', -1)">
                    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M3 7H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  </button>
                  <output class="stepper-value">{{ signupState.guest }}</output>
                  <button class="stepper-btn" type="button" :disabled="signupState.guest >= 6" aria-label="增加群外報名人數" @click="adjustSignupCount('guest', 1)">
                    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M7 3V11M3 7H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="guest-fields" aria-live="polite">
                <div v-for="(guest, index) in signupState.guests" :key="index" class="guest-row">
                  <input v-model="guest.name" class="guest-input" type="text" :name="`guest-name-${index + 1}`" placeholder="群外朋友姓名" :aria-label="`第 ${index + 1} 位群外朋友姓名`" />
                  <select v-model="guest.gender" class="guest-select" :name="`guest-gender-${index + 1}`" required :aria-label="`第 ${index + 1} 位群外朋友性別`">
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
          <button ref="confirmSignupButton" class="confirm-signup" type="button" :disabled="!isSignupChanged" @click="submitSignup">確認報名</button>
          <p class="signup-note">送出不代表報名成功，請以名單為準</p>
        </div>
      </section>
    </div>

    <div class="success-dialog-overlay" :class="{ 'is-open': successDialog.open }" :aria-hidden="String(!successDialog.open)" :inert="!successDialog.open">
      <section class="success-dialog" role="dialog" aria-modal="true" aria-labelledby="success-dialog-title">
        <h2 class="success-dialog-title" id="success-dialog-title">{{ successDialog.title }}</h2>
        <p class="success-dialog-copy">{{ successDialog.copy }}</p>
        <button ref="successDialogButton" class="success-dialog-button" type="button" @click="setSuccessDialogOpen(false)">{{ successDialog.buttonText }}</button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.active-activity-page {
  height: 100%;
  position: relative;
}

.scroll-content {
  min-height: 100%;
  background: linear-gradient(180deg, #5768ff 0%, #6373ff 7%, #7d8af9 13%, #c1c6f1 20%, #e8e9f5 27%, #fff 35%, #fff 100%);
}

.hero {
  position: relative;
  background: transparent;
  padding: 78px 16px 92px;
  min-height: 219px;
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: none;
  pointer-events: none;
}

.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  margin: 0 0 -60px;
  min-height: 60px;
  background: rgba(255, 255, 255, var(--nav-bg-opacity, 0));
  backdrop-filter: blur(calc(var(--nav-progress, 0) * 14px));
  -webkit-backdrop-filter: blur(calc(var(--nav-progress, 0) * 14px));
  box-shadow: 0 1px 0 rgba(16, 24, 64, calc(var(--nav-progress, 0) * 0.08));
}

.back-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  color: #fff;
  flex: 0 0 auto;
  transition: color 0.25s ease;
}

.back-btn svg {
  width: 24px;
  height: 24px;
}

.brand {
  width: 65px;
  height: 22px;
  background: url('/images/logo-white.svg') center/contain no-repeat;
  flex: 0 0 auto;
  transition: filter 0.25s ease;
}

.nav-title {
  flex: 1;
  opacity: 0;
  font-size: 15px;
  color: #fff;
  text-align: center;
}

.menu-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.menu-btn img {
  width: 24px;
  height: 24px;
  transition: filter 0.25s ease;
}

.nav.is-scrolled {
  background: rgba(255, 255, 255, var(--nav-bg-opacity, 0.94));
}

.nav.is-scrolled .brand {
  background-image: url('/images/logo-purple.svg');
  filter: none;
}

.nav.is-scrolled .menu-btn img {
  filter: brightness(0) saturate(100%) invert(21%) sepia(27%) saturate(1897%) hue-rotate(210deg) brightness(93%) contrast(96%);
}

.nav.is-scrolled .back-btn {
  color: var(--text);
}

.hero-layout {
  position: relative;
  z-index: 1;
}

.hero-cat {
  position: absolute;
  right: 18px;
  bottom: 52px;
  width: 158px;
  height: auto;
  z-index: 1;
  pointer-events: none;
}

.hero-copy {
  position: relative;
  z-index: 2;
  color: #fff;
  padding-top: 0;
  transform: none;
  text-align: left;
}

.hero-copy h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.36;
  font-weight: 700;
  letter-spacing: 0.56px;
}

.summary-card {
  position: relative;
  z-index: 3;
  margin: -88px 16px 0;
  min-height: 107px;
  padding: 16px 16px 0;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: var(--shadow-primary-card);
  overflow: hidden;
}

.summary-main {
  display: flex;
  align-items: center;
  gap: 17px;
  padding-bottom: 16px;
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

.summary-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.summary-time {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0;
  font-size: 22px;
  line-height: 1.25;
  font-weight: 700;
  color: #474d66;
  white-space: nowrap;
}

.summary-date {
  letter-spacing: 0;
  font-kerning: normal;
  font-feature-settings: 'kern';
  margin-right: -2px;
}

.summary-weekday {
  display: inline-block;
  font-size: 13px;
  transform: translateX(-4px);
}

.summary-separator {
  display: inline-block;
  width: 1px;
  height: 18px;
  color: #d8dae5;
  background: currentColor;
  font-size: 0;
  line-height: 0;
  font-weight: 400;
  margin: 0 12px 0 2px;
}

.summary-location {
  margin: 0;
  font-size: 15px;
  line-height: 1.25;
  font-weight: 400;
  color: #474d66;
  opacity: 0.85;
  white-space: nowrap;
}

.summary-status {
  margin: 0 -16px;
  padding: 16px 16px;
  border-top: 1px solid #edf0fb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.summary-status-text {
  margin: 0;
  min-width: 0;
  font-size: 15px;
  line-height: 1.4;
  font-weight: 400;
  color: #474d66;
  white-space: nowrap;
}

.summary-status-value {
  color: #8f95b2;
  font-weight: 400;
}

.summary-status-value.is-success {
  color: #17acba;
}

.summary-fee {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
  color: #474d66;
  white-space: nowrap;
}

.summary-fee-money {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  margin-right: -10px;
}

.summary-fee-air {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  margin-right: -4px;
}

.summary-fee-amount {
  font-size: 15px;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: 0;
  margin-right: -4px;
}

.summary-fee-state {
  font-size: 15px;
  line-height: 1.25;
  font-weight: 400;
}

.summary-fee-state[hidden] {
  display: none;
}

.leave-button {
  min-width: 0;
  min-height: 0;
  padding: 7px 14px;
  border: 1px solid #e3e6ef;
  border-radius: 999px;
  background: #fff;
  color: #474d66;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 400;
}

.content {
  padding: 24px 16px 42px;
}

.segment-tabs {
  display: none;
  align-items: center;
  gap: 10px;
  margin: 0 0 16px;
}

.segment-tab {
  min-width: 56px;
  min-height: 34px;
  padding: 6px 17px;
  border-radius: 999px;
  background: #edeff5;
  color: #8d94ad;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.4;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.segment-tab.is-active {
  background: var(--primary-700);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 10px 20px rgba(87, 104, 255, 0.22);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
}

.rank {
  width: 18px;
  flex: 0 0 auto;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-700);
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  background: linear-gradient(135deg, #8aa0ff 0%, #5768ff 100%);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  word-break: break-word;
}

.status-tag {
  flex: 0 0 auto;
  min-width: 44px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #f2f4fa;
  color: #8b92b1;
  font-size: 12px;
  line-height: 1;
  text-align: center;
}

.footer-bar {
  position: sticky;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  padding: 0 16px 16px;
  background: #000;
}

.footer-fade {
  position: absolute;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #fff 50%, #fff 100%);
  bottom: 0;
  left: 0;
  width: 100%;
  height: 154px;
}

.cta {
  position: relative;
  z-index: 10;
  width: 100%;
  min-height: 57px;
  border-radius: 12px;
  background: #1bc4bf;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  box-shadow: none;
}

.signup-overlay {
  position: fixed;
  overflow: hidden;
  left: 0;
  right: 0;
  margin: auto;
  z-index: 9999;
  pointer-events: none;
}

.signup-overlay.is-open {
  pointer-events: auto;
}

.signup-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.28s ease;
}

.signup-overlay.is-open .signup-backdrop {
  opacity: 1;
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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 9px;
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
  color: #101840;
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
  background: #5768ff;
  color: #fff;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
}

.version {
  margin-top: 18px;
  text-align: center;
  font-size: 11px;
  line-height: 1.4;
  color: #7a84a7;
  font-variant-numeric: tabular-nums;
}

.menu-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.menu-overlay.is-open {
  pointer-events: auto;
}

.menu-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.28s ease;
}

.menu-overlay.is-open .menu-backdrop {
  opacity: 1;
}

.side-menu {
  position: absolute;
  top: 0;
  right: 0;
  width: min(329px, calc(100% - 61px));
  height: 100%;
  padding: 32px 0;
  background: #fff;
  color: var(--text);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.side-menu::-webkit-scrollbar {
  display: none;
}

.menu-overlay.is-open .side-menu {
  transform: translateX(0);
}

.drawer-profile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px 28px;
}

.drawer-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
}

.drawer-user-stack {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 4px;
}

.drawer-user {
  margin: 0;
  font-size: 20px;
  line-height: 1.25;
  font-weight: 500;
  color: #101840;
}

.drawer-role {
  width: max-content;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid rgba(217, 141, 53, 0.3);
  border-radius: 6px;
  background: rgba(248, 222, 183, 0.2);
  color: #c79051;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 400;
  white-space: nowrap;
}

.drawer-role svg {
  display: block;
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  color: #e6b883;
}

.drawer-close {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  color: #474d66;
  align-self: flex-start;
  margin-top: 0;
  flex: 0 0 auto;
}

.drawer-content {
  display: grid;
  gap: 23px;
  flex: 1;
  padding-bottom: 32px;
}

.drawer-section {
  padding: 0 32px 0 16px;
}

.drawer-section-title {
  margin: 0 0 16px;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 400;
  color: #8f95b2;
}

.drawer-list {
  display: grid;
  gap: 20px;
}

.drawer-link {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 36px;
  color: #101840;
  text-decoration: none;
  font-size: 16px;
  line-height: 1.4;
}

.drawer-link.is-pending {
  opacity: 0.4;
  pointer-events: none;
  cursor: default;
}

.drawer-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  background: #a8b1f4;
  color: #8f95b2;
  overflow: hidden;
}

.drawer-icon img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  filter: drop-shadow(3.2px 3.2px 12px rgba(87, 104, 255, 0.55));
}

.drawer-icon.is-warm {
  background: #f2b57c;
}

.drawer-icon.is-warm img {
  filter: drop-shadow(3.8px 3.8px 14px rgba(148, 77, 27, 0.45));
}

.drawer-icon.is-muted {
  background: #edeff5;
}

.drawer-divider {
  height: 1px;
  background: #edeff5;
}

.drawer-footer {
  margin-top: auto;
  padding: 0 16px;
}

.drawer-create-button {
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #1bc4bf;
  color: #fff;
  text-decoration: none;
  font-size: 17px;
  line-height: 1.25;
  font-weight: 500;
}

@media (max-width: 380px) {
  .side-menu {
    width: 84vw;
  }

  .drawer-section {
    padding-right: 24px;
  }
}

@media (max-width: 500px) {
  body {
    padding: 0;
    display: block;
    overflow: hidden;
    background: #fff;
  }

  .app-shell {
    width: 100%;
    height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }

  .hero {
    border-radius: 0;
  }
}
</style>
