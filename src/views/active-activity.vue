<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ActivityMemberSection from '~/components/activity/ActivityMemberSection.vue'
import ActivitySummaryCard from '~/components/activity/ActivitySummaryCard.vue'
import { useLiffStore } from '~/stores/liff'
import { supabase } from '~/utils/supabase'

const route = useRoute()
const liffStore = useLiffStore()
const activityData = ref(null)

const activityType = computed(() => route.query.type || 'latest')

const heroTitle = computed(() => {
  if (activityType.value === 'upcoming') return '即將到來的球局'
  if (activityType.value === 'ended') return '已結束的球局'
  return '最新球局報名'
})

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const resolvedDate = computed(() => {
  if (route.query.date) return route.query.date
  if (!activityData.value?.dates) return null
  const today = new Date().toISOString().split('T')[0]
  const sorted = activityData.value.dates.slice().sort()
  return sorted.find(d => d >= today) || sorted[sorted.length - 1] || null
})

const summaryDate = computed(() => {
  if (!resolvedDate.value) return '—'
  const [, month, day] = resolvedDate.value.split('-')
  return `${Number(month)}.${day}`
})

const summaryWeekday = computed(() => {
  if (!resolvedDate.value) return '—'
  return WEEKDAYS[new Date(resolvedDate.value + 'T00:00:00').getDay()]
})

const summaryTime = computed(() => {
  if (!activityData.value) return '—'
  const fmt = t => (t || '').replace(/^0/, '').slice(0, 5)
  return `${fmt(activityData.value.start_time)}-${fmt(activityData.value.end_time)}`
})

const summaryLocation = computed(() => activityData.value?.location || '板橋柏吉倫排球場')

const summaryFeeAmount = computed(() => {
  if (!activityData.value) return 255
  return activityData.value.pickup_fee_per_session || activityData.value.season_fee_per_session || 0
})

const registrations = ref([])
const myRegistration = ref(null)
const memberGenders = ref({})

// 使用者在此頁設定完性別後，立即更新本地 memberGenders，不需重抓名單
watch(() => liffStore.gender, (newGender) => {
  if (liffStore.userId && newGender) {
    memberGenders.value = { ...memberGenders.value, [liffStore.userId]: newGender }
  }
})

async function fetchRegistrations() {
  const activityId = route.query.id || activityData.value?.id
  const date = resolvedDate.value
  if (!activityId || !date) return
  const { data } = await supabase.from('registrations').select('*').eq('activity_id', activityId).eq('activity_date', date).eq('status', 'active').order('created_at', { ascending: true })
  if (data) {
    registrations.value = data
    myRegistration.value = data.find(r => r.user_id === liffStore.userId) || null

    const userIds = [...new Set(data.map(r => r.user_id))]
    if (userIds.length) {
      const { data: memberData } = await supabase.from('members').select('user_id, gender').in('user_id', userIds)
      const genders = memberData
        ? Object.fromEntries(memberData.map(m => [m.user_id, m.gender || null]))
        : {}
      // DB 尚未更新時（例如 RLS 尚未開放 UPDATE），優先保留本機已設定的性別
      if (liffStore.userId && liffStore.gender) {
        genders[liffStore.userId] = liffStore.gender
      }
      memberGenders.value = genders
    } else {
      memberGenders.value = {}
    }
  }
}

onMounted(async () => {
  // 確保 LIFF 初始化完成，userId 就位後再抓報名資料，避免把自己的報名當成新報名
  await liffStore.initialize()

  const id = route.query.id
  if (id) {
    const { data } = await supabase.from('activities').select('id, title, location, dates, start_time, end_time, single_capacity, pickup_fee_per_session, season_fee_per_session').eq('id', id).single()
    if (data) activityData.value = data
  } else {
    const { data } = await supabase
      .from('activities')
      .select('id, title, location, dates, start_time, end_time, single_capacity, pickup_fee_per_session, season_fee_per_session')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (data) activityData.value = data
  }

  await fetchRegistrations()
})

const vacancyCount = computed(() => {
  const capacity = activityData.value?.single_capacity ?? 0
  const confirmed = memberList.value.filter(m => !m.status).length
  return Math.max(0, capacity - confirmed)
})

function formatRegistrationTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

const isAdmin = computed(() => liffStore.role === 'organizer' || liffStore.role === 'engineer')

const memberList = computed(() => {
  const capacity = activityData.value?.single_capacity ?? Infinity
  const members = []
  registrations.value.forEach(reg => {
    if (reg.self_count > 0) {
      const ts = reg.self_added_at || reg.created_at
      members.push({ name: reg.display_name, badge: reg.display_name.charAt(0), image: reg.picture_url || null, time: formatRegistrationTime(ts), _ts: ts, gender: memberGenders.value[reg.user_id] || null, _regId: reg.id, _memberType: 'self', _guestIndex: -1 })
    }
    ;(reg.guests || []).forEach((guest, gIdx) => {
      const ts = guest.added_at || reg.created_at
      members.push({ name: guest.name || '群外', badge: (guest.name || '群').charAt(0), time: formatRegistrationTime(ts), _ts: ts, gender: guest.gender || null, _regId: reg.id, _memberType: 'guest', _guestIndex: gIdx })
    })
  })
  members.sort((a, b) => new Date(a._ts) - new Date(b._ts))
  return members.map(({ _ts, ...m }, i) => ({ ...m, status: i >= capacity ? '候補' : undefined }))
})

const removeDialog = reactive({ open: false, member: null })
const removeConfirmButton = ref(null)

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

  const reg = registrations.value.find(r => r.id === member._regId)
  if (!reg) return

  try {
    if (member._memberType === 'self') {
      if ((reg.guest_count || 0) === 0) {
        await supabase.from('registrations').delete().eq('id', reg.id)
      } else {
        await supabase.from('registrations').update({ self_count: 0, self_added_at: null }).eq('id', reg.id)
      }
    } else if (member._memberType === 'guest') {
      const newGuests = (reg.guests || []).filter((_, i) => i !== member._guestIndex)
      const newGuestCount = newGuests.length
      if ((reg.self_count || 0) === 0 && newGuestCount === 0) {
        await supabase.from('registrations').delete().eq('id', reg.id)
      } else {
        await supabase.from('registrations').update({ guests: newGuests, guest_count: newGuestCount }).eq('id', reg.id)
      }
    }
    await fetchRegistrations()
  } catch {
    // 靜默失敗，名單資料不變
  }
}
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
const successDialog = reactive({
  open: false,
  title: '報名已送出',
  copy: '已送出報名 0 位，請稍候確認名單是否成功加入',
  buttonText: '確認',
  onButtonClick: null,
})

const signupTotal = computed(() => signupState.self + signupState.guest)
const submittedTotal = computed(() => (myRegistration.value ? (myRegistration.value.self_count || 0) + (myRegistration.value.guest_count || 0) : 0))
const hasSubmittedSignup = computed(() => submittedTotal.value > 0)
const summaryFee = computed(() => submittedTotal.value * summaryFeeAmount.value)
const summaryStatusText = computed(() => (hasSubmittedSignup.value ? `成功卡位 ${submittedTotal.value} 位` : '無報名'))
const summaryFeeLabel = computed(() => (hasSubmittedSignup.value ? `費用 ${summaryFee.value} 元，未付` : `費用 ${summaryFeeAmount.value} 元`))
const heroCtaText = computed(() => (hasSubmittedSignup.value ? '管理報名' : '我要報名'))
const isSignupChanged = computed(() => {
  const prevSelf = myRegistration.value?.self_count ?? 0
  const prevGuest = myRegistration.value?.guest_count ?? 0
  const prevGuests = myRegistration.value?.guests ?? []

  if (signupState.self !== prevSelf || signupState.guest !== prevGuest) return true

  for (let index = 0; index < signupState.guest; index += 1) {
    const cur = signupState.guests[index] || { name: '', gender: '' }
    const prev = prevGuests[index] || { name: '', gender: '' }
    if ((cur.name || '') !== (prev.name || '') || (cur.gender || '') !== (prev.gender || '')) return true
  }

  return false
})

function focusElement(target) {
  nextTick(() => {
    target.value?.focus({ preventScroll: true })
  })
}

function setSignupOpen(isOpen, options = {}) {
  const { restoreFocus = true } = options
  signupOpen.value = isOpen

  if (isOpen) {
    // 預填現有報名資料
    if (myRegistration.value) {
      signupState.self = myRegistration.value.self_count || 0
      signupState.guest = myRegistration.value.guest_count || 0
      signupState.guests = (myRegistration.value.guests || []).map(g => ({ name: g.name || '', gender: g.gender || '', added_at: g.added_at || null }))
      while (signupState.guests.length < signupState.guest) signupState.guests.push({ name: '', gender: '', added_at: new Date().toISOString() })
    } else {
      signupState.self = 0
      signupState.guest = 0
      signupState.guests = []
    }
    focusElement(signupCloseButton)
  } else if (restoreFocus) {
    focusElement(heroCtaButton)
  }
}

function setSuccessDialogOpen(isOpen, options = {}) {
  if (options.title) successDialog.title = options.title
  if (options.copy) successDialog.copy = options.copy
  if (options.buttonText) successDialog.buttonText = options.buttonText
  successDialog.onButtonClick = options.onButtonClick ?? null

  successDialog.open = isOpen

  if (isOpen) {
    focusElement(successDialogButton)
  } else if (signupOpen.value) {
    focusElement(confirmSignupButton)
  } else {
    focusElement(heroCtaButton)
  }
}

function handleDialogButtonClick() {
  const cb = successDialog.onButtonClick
  setSuccessDialogOpen(false)
  if (cb) cb()
}

function setSegmentTab(tab) {
  activeSegment.value = tab
}

function adjustSignupCount(type, direction) {
  const max = type === 'self' ? 1 : 6
  signupState[type] = Math.max(0, Math.min(max, signupState[type] + direction))

  if (type !== 'guest') return

  while (signupState.guests.length < signupState.guest) {
    signupState.guests.push({ name: '', gender: '', added_at: new Date().toISOString() })
  }

  signupState.guests.splice(signupState.guest)
}

async function submitSignup() {
  // 等待 LIFF 完整初始化，避免 race condition 導致 userId 還沒就緒就被判斷為未登入
  await liffStore.initialize()

  if (!liffStore.userId) {
    if (liffStore.isExternalBrowser) {
      setSuccessDialogOpen(true, {
        title: '請從 LINE 開啟',
        copy: '報名功能僅支援在 LINE 應用程式內使用。請複製此頁面網址，在 LINE 中貼上並開啟連結。',
        buttonText: '了解',
      })
    } else {
      setSuccessDialogOpen(true, {
        title: '請先登入',
        copy: '需要以 LINE 帳號登入才能送出報名，點擊下方按鈕前往登入。',
        buttonText: '前往 LINE 登入',
        onButtonClick: () => liffStore.login(),
      })
    }
    return
  }

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

  // 取消報名：刪掉整筆 row，讓重報時 INSERT 新 row 取得新的 created_at 與排名
  if (total <= 0 && myRegistration.value) {
    try {
      await supabase.from('registrations').delete().eq('id', myRegistration.value.id)
      await fetchRegistrations()
      setSignupOpen(false, { restoreFocus: false })
      setSuccessDialogOpen(true, {
        title: '報名已取消',
        copy: '已取消報名，名單將同步更新。',
        buttonText: '確認',
      })
    } catch {
      setSuccessDialogOpen(true, { title: '取消失敗', copy: '取消時發生錯誤，請稍後再試。', buttonText: '確認' })
    }
    return
  }

  const submitTime = new Date().toISOString()
  const isNewRegistration = !myRegistration.value
  const prevSelfCount = myRegistration.value?.self_count ?? 0
  const prevGuests = myRegistration.value?.guests ?? []

  const selfAddedAt = signupState.self === 1
    ? (prevSelfCount === 0 ? submitTime : (myRegistration.value?.self_added_at ?? submitTime))
    : null

  const guestsWithTime = signupState.guests.slice(0, signupState.guest).map((g, i) => ({
    ...g,
    added_at: isNewRegistration || i >= prevGuests.length ? submitTime : (prevGuests[i].added_at || submitTime),
  }))

  const payload = {
    activity_id: activityData.value?.id,
    activity_date: resolvedDate.value,
    user_id: liffStore.userId,
    display_name: liffStore.displayName,
    picture_url: liffStore.pictureUrl || null,
    self_count: signupState.self,
    self_added_at: selfAddedAt,
    guest_count: signupState.guest,
    guests: guestsWithTime,
    status: 'active',
  }

  try {
    if (myRegistration.value) {
      await supabase.from('registrations').update(payload).eq('id', myRegistration.value.id)
    } else {
      await supabase.from('registrations').insert(payload)
    }
    await fetchRegistrations()
    setSignupOpen(false, { restoreFocus: false })
    setSuccessDialogOpen(true, {
      title: isUpdatingExistingSignup ? '報名已更新' : '報名已送出',
      copy: `${isUpdatingExistingSignup ? '已更新報名 ' : '已送出報名 '}${total} 位，請稍候確認名單是否成功加入`,
      buttonText: '確認',
    })
  } catch {
    setSuccessDialogOpen(true, { title: '報名失敗', copy: '送出時發生錯誤，請稍後再試。', buttonText: '確認' })
  }
}

function handleEscape() {
  if (removeDialog.open) {
    cancelRemove()
    return
  }

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
  <main class="active-activity-page" :class="[{ 'signup-open': signupOpen }, `hero-${activityType}`]" @keydown.esc="handleEscape">
    <section class="hero">
      <img v-if="activityType === 'latest'" class="hero-cat" src="/images/cat-hide.png" alt="" aria-hidden="true" />
      <div class="hero-layout">
        <div class="hero-copy">
          <h1>{{ heroTitle }}</h1>
        </div>
      </div>
    </section>

    <ActivitySummaryCard
      :date="summaryDate"
      :weekday="summaryWeekday"
      :time="summaryTime"
      :location="summaryLocation"
      status-label="狀態"
      :status-value="summaryStatusText"
      :status-tone="hasSubmittedSignup ? 'success' : 'default'"
      :fee-amount="hasSubmittedSignup ? summaryFee : summaryFeeAmount"
      :fee-state="hasSubmittedSignup ? '未付' : ''"
      :fee-aria-label="summaryFeeLabel"
      vacancy-label="臨打缺"
      :vacancy-value="vacancyCount"
    />

    <ActivityMemberSection :tabs="SEGMENT_TABS" :active-segment="activeSegment" :members="memberList" :bottom-spacing="memberList.length === 0 ? 0 : 100" :is-admin="isAdmin" @change="setSegmentTab" @remove="handleRemoveRequest" />
    <p v-if="memberList.length === 0" class="empty-member-hint">目前尚無報名資料</p>

    <div v-if="activityType !== 'ended'" class="footer-bar">
      <div class="footer-fade"></div>
      <button v-if="activityType === 'upcoming'" class="cta cta-disabled" type="button" disabled>尚未開放</button>
      <button v-else ref="heroCtaButton" class="cta" type="button" @click="setSignupOpen(true)">{{ heroCtaText }}</button>
    </div>

    <div class="signup-overlay phone-container modal-frame" :class="{ 'is-open': signupOpen }" :aria-hidden="String(!signupOpen)" :inert="!signupOpen">
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

    <div class="success-dialog-overlay shared-dialog-overlay" :class="{ 'is-open': successDialog.open }" :aria-hidden="String(!successDialog.open)" :inert="!successDialog.open">
      <section class="success-dialog shared-dialog" role="dialog" aria-modal="true" aria-labelledby="success-dialog-title">
        <h2 class="success-dialog-title shared-dialog-title" id="success-dialog-title">{{ successDialog.title }}</h2>
        <p class="success-dialog-copy shared-dialog-copy">{{ successDialog.copy }}</p>
        <button ref="successDialogButton" class="success-dialog-button shared-dialog-button" type="button" @click="handleDialogButtonClick">{{ successDialog.buttonText }}</button>
      </section>
    </div>

    <div class="remove-dialog-overlay shared-dialog-overlay" :class="{ 'is-open': removeDialog.open }" :aria-hidden="String(!removeDialog.open)" :inert="!removeDialog.open">
      <button class="remove-dialog-backdrop" type="button" aria-label="取消移除" @click="cancelRemove"></button>
      <section class="remove-dialog shared-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-dialog-title">
        <h2 class="remove-dialog-title shared-dialog-title" id="remove-dialog-title">確認移除成員？</h2>
        <p class="remove-dialog-copy shared-dialog-copy">確定要將「{{ removeDialog.member?.name }}」從名單中移除嗎？此操作無法復原。</p>
        <div class="remove-dialog-actions">
          <button type="button" class="remove-dialog-cancel" @click="cancelRemove">取消</button>
          <button ref="removeConfirmButton" type="button" class="remove-dialog-confirm" @click="confirmRemove">確認移除</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.active-activity-page {
  height: 100%;
  background: linear-gradient(180deg, #5768ff 0%, #6373ff 7%, #7d8af9 13%, #c1c6f1 20%, #e8e9f5 27%, #fff 35%, #fff 100%);
}

.active-activity-page.hero-upcoming {
  background: linear-gradient(180deg, #1bc4bf 0%, #22cec9 7%, #3dd5d0 13%, #a8ebe9 20%, #ddf5f4 27%, #fff 35%, #fff 100%);
}

.active-activity-page.hero-ended {
  background: linear-gradient(180deg, #7b82a8 0%, #8b91b8 7%, #9ea4c6 13%, #c9cbd8 20%, #e6e6ef 27%, #fff 35%, #fff 100%);
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

.footer-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 24.375rem;
  z-index: 15;
  padding: 0 16px 16px;
  background: transparent;
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
  font-size: 17px;
  font-weight: 500;
  box-shadow: none;
}

.cta-disabled {
  background: #d8dae5;
  color: #8f95b2;
  cursor: default;
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
  position: fixed;
  inset: 0;
  z-index: 10000;
}

.remove-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
}

.remove-dialog-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.remove-dialog {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  max-width: 340px;
  margin: auto;
  padding: 28px 24px 24px;
  border-radius: 16px;
  background: #fff;
}

.remove-dialog-title {
  color: #d14343;
}

.remove-dialog-copy {
  margin: 10px 0 0;
  color: #474d66;
  font-size: 14px;
  line-height: 1.6;
}

.remove-dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 24px;
}

.remove-dialog-cancel {
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid #d8dae5;
  background: #fff;
  color: #474d66;
  font-size: 15px;
  font-weight: 500;
}

.remove-dialog-confirm {
  min-height: 44px;
  border-radius: 10px;
  background: #d14343;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.empty-member-hint {
  padding: 0 16px 80px;
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
  color: #8f95b2;
}

@media (min-width: 768px) {
  .footer-bar {
    bottom: 24px;
    border-radius: 0 0 1.5rem 1.5rem;
    overflow: hidden;
  }
}
</style>
