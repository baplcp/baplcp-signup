<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ActivityMemberSection from '~/components/activity/ActivityMemberSection.vue'
import ActivitySummaryCard from '~/components/activity/ActivitySummaryCard.vue'
import { useLiffStore } from '~/stores/liff'
import { supabase } from '~/utils/supabase'
import { startLineOAuth } from '~/utils/lineOAuth'

const route = useRoute()
const router = useRouter()
const liffStore = useLiffStore()
const activityData = ref(null)
const activityNotFound = ref(false)

const activityType = computed(() => route.query.type || 'latest')

const heroTitle = computed(() => {
  if (activityType.value === 'season') return activityData.value?.title || '季打報名'
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

const isLoading = ref(true)
const acEnabled = ref(false)
const acFeePerSession = ref(0)

// 季打報名
const seasonRegistrations = ref([])
const mySeasonRegistration = ref(null)
const myCancelledSeasonRegistration = ref(null)
const showAllDatesDialog = ref(false)

const activitySessionCount = computed(() => activityData.value?.dates?.length ?? 0)

const summaryFeeAmount = computed(() => {
  if (!activityData.value) return 255
  if (activityType.value === 'season') {
    return activityData.value.season_total_fee || 0
  }
  const base = activityData.value.pickup_fee_per_session || activityData.value.season_fee_per_session || 0
  return acEnabled.value ? base + acFeePerSession.value : base
})

const registrations = ref([])
const cancelledRegistrations = ref([])
const localCancelledMembers = ref([]) // 本地取消清單（{ name, badge, image }），不被 fetchRegistrations 覆蓋
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
  if (!activityId) return

  if (activityType.value === 'season') {
    // 季打頁面：抓 activity_date IS NULL 的報名
    const { data } = await supabase
      .from('registrations')
      .select('*')
      .eq('activity_id', activityId)
      .is('activity_date', null)
      .in('status', ['active', 'cancelled'])
      .order('created_at', { ascending: true })
    if (data) {
      const active = data.filter(r => r.status === 'active')
      const cancelled = data.filter(r => r.status === 'cancelled')
      registrations.value = active
      cancelledRegistrations.value = cancelled
      myRegistration.value = active.find(r => r.user_id === liffStore.userId) || null
      seasonRegistrations.value = active
      mySeasonRegistration.value = myRegistration.value
      myCancelledSeasonRegistration.value = cancelled.find(r => r.user_id === liffStore.userId) || null

      const userIds = [...new Set(active.map(r => r.user_id))]
      if (userIds.length) {
        const { data: memberData } = await supabase.from('members').select('user_id, gender').in('user_id', userIds)
        const genders = memberData ? Object.fromEntries(memberData.map(m => [m.user_id, m.gender || null])) : {}
        if (liffStore.userId && liffStore.gender) genders[liffStore.userId] = liffStore.gender
        memberGenders.value = genders
      } else {
        memberGenders.value = {}
      }
    }
    return
  }

  // 臨打頁面：抓指定日期的報名
  const date = resolvedDate.value
  if (!date) return
  const { data } = await supabase
    .from('registrations')
    .select('*')
    .eq('activity_id', activityId)
    .eq('activity_date', date)
    .in('status', ['active', 'cancelled'])
    .order('created_at', { ascending: true })

  if (data) {
    const active = data.filter(r => r.status === 'active')
    const cancelled = data.filter(r => r.status === 'cancelled')
    registrations.value = active
    cancelledRegistrations.value = cancelled
    myRegistration.value = active.find(r => r.user_id === liffStore.userId) || null

    const userIds = [...new Set(active.map(r => r.user_id))]
    const genders = {}
    if (userIds.length) {
      const { data: memberData } = await supabase.from('members').select('user_id, gender').in('user_id', userIds)
      if (memberData) memberData.forEach(m => { genders[m.user_id] = m.gender || null })
    }
    if (liffStore.userId && liffStore.gender) genders[liffStore.userId] = liffStore.gender
    memberGenders.value = genders
  }

  // 同步抓季打報名（供臨打頁面顯示季打成員）
  const { data: seasonData } = await supabase
    .from('registrations')
    .select('*')
    .eq('activity_id', activityId)
    .is('activity_date', null)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  seasonRegistrations.value = seasonData || []
  mySeasonRegistration.value = seasonData?.find(r => r.user_id === liffStore.userId) || null

  // 補查季打成員的性別（尚未在 memberGenders 中的）
  const seasonUserIds = [...new Set((seasonData || []).map(r => r.user_id))].filter(id => !(id in memberGenders.value))
  if (seasonUserIds.length) {
    const { data: seasonMemberData } = await supabase.from('members').select('user_id, gender').in('user_id', seasonUserIds)
    if (seasonMemberData) {
      const updated = { ...memberGenders.value }
      seasonMemberData.forEach(m => { updated[m.user_id] = m.gender || null })
      memberGenders.value = updated
    }
  }
}

onMounted(async () => {
  const AC_FIELDS = 'id, title, location, dates, start_time, end_time, single_capacity, pickup_fee_per_session, season_fee_per_session, season_total_fee, season_capacity, season_enabled, ac_enabled, ac_fee, pickup_open_days_before, pickup_open_time, season_open_date, season_open_time'
  const id = route.query.id

  // 預先啟動 activity 查詢，與 LIFF init 並行，縮短整體等待時間
  const activityFetchPromise = id
    ? supabase.from('activities').select(AC_FIELDS).eq('id', id).single()
    : supabase.from('activities').select(AC_FIELDS).order('created_at', { ascending: false }).limit(1).single()

  // 確保 LIFF 初始化完成，userId 就位後再抓報名資料，避免把自己的報名當成新報名
  await liffStore.initialize()

  // 未登入則立即導向登入，不等待按下報名按鈕
  if (!liffStore.userId) {
    if (liffStore.isExternalBrowser) {
      startLineOAuth()
    } else {
      liffStore.login()
    }
    return
  }

  const { data } = await activityFetchPromise
  if (data) {
    activityData.value = data
    acEnabled.value = data.ac_enabled ?? false
    acFeePerSession.value = data.ac_fee ?? 0
  } else if (id) {
    activityNotFound.value = true
    return
  }

  await fetchRegistrations()
  isLoading.value = false
  _nowTickInterval = setInterval(() => { nowTick.value = new Date() }, 1000)

  _realtimeChannel = supabase
    .channel('registrations-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
      fetchRegistrations()
    })
    .subscribe()
})

// 每秒更新的現在時間，用於倒數計時
const nowTick = ref(new Date())
let _nowTickInterval = null
let _realtimeChannel = null

onUnmounted(() => {
  if (_nowTickInterval) clearInterval(_nowTickInterval)
  if (_realtimeChannel) supabase.removeChannel(_realtimeChannel)
})

// 報名開放時間（台灣時間 UTC+8，無日光節約）
const registrationOpenAt = computed(() => {
  const a = activityData.value
  if (!a) return null
  if (activityType.value === 'season') {
    if (!a.season_open_date || !a.season_open_time) return null
    const [y, mo, d] = a.season_open_date.split('-').map(Number)
    const [h, m] = a.season_open_time.split(':').map(Number)
    return new Date(Date.UTC(y, mo - 1, d, h - 8, m, 0))
  }
  if (!resolvedDate.value || a.pickup_open_days_before == null || !a.pickup_open_time) return null
  const [y, mo, d] = resolvedDate.value.split('-').map(Number)
  const [h, m] = a.pickup_open_time.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d - a.pickup_open_days_before, h - 8, m, 0))
})

// 季打成員在臨打頁面是否為請假模式
const isSeasonLeaveMode = computed(() => {
  if (activityType.value === 'season') return false
  return !!mySeasonRegistration.value
})

const isRegistrationOpen = computed(() => {
  if (!registrationOpenAt.value) return true
  return nowTick.value >= registrationOpenAt.value
})

const registrationCountdown = computed(() => {
  if (isRegistrationOpen.value || !registrationOpenAt.value) return null
  const diff = registrationOpenAt.value.getTime() - nowTick.value.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} 後開放`
    : `${m}:${String(s).padStart(2, '0')} 後開放`
})

const vacancyCount = computed(() => {
  if (activityType.value === 'season') {
    const cap = activityData.value?.season_capacity
    if (!cap || cap === 'unlimited') return '∞'
    const confirmed = memberList.value.filter(m => !m.status).length
    return Math.max(0, Number(cap) - confirmed)
  }
  const capacity = activityData.value?.single_capacity ?? 0
  const confirmed = memberList.value.filter(m => !m.status).length
  return Math.max(0, capacity - confirmed)
})

function formatAllDate(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  const weekday = WEEKDAYS[new Date(dateStr + 'T00:00:00').getDay()]
  return `${Number(m)} 月 ${Number(d)} 日（${weekday}）`
}

function formatRegistrationTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

const isAdmin = computed(() => liffStore.role === 'organizer' || liffStore.role === 'engineer')
const adminMode = ref(false)

const memberList = computed(() => {
  const capacity = activityData.value?.single_capacity ?? Infinity
  const members = []

  // 臨打頁面：先插入未請假的季打成員
  if (activityType.value !== 'season') {
    const date = resolvedDate.value
    seasonRegistrations.value.forEach(reg => {
      if ((reg.leave_dates || []).includes(date)) return
      if (reg.self_count > 0) {
        const ts = reg.created_at
        members.push({
          name: reg.display_name,
          badge: reg.display_name.charAt(0),
          image: reg.picture_url || null,
          time: formatRegistrationTime(ts),
          _ts: ts,
          gender: memberGenders.value[reg.user_id] || null,
          _regId: reg.id,
          _memberType: 'season_self',
          _guestIndex: -1,
          isSeason: true,
          paidCourt: reg.paid_court ?? false,
          paidAc: reg.paid_ac ?? false,
        })
      }
    })
  }

  const overflowGuests = []

  registrations.value.forEach(reg => {
    if (reg.self_count > 0) {
      const ts = reg.self_added_at || reg.created_at
      members.push({ name: reg.display_name, badge: reg.display_name.charAt(0), image: reg.picture_url || null, time: formatRegistrationTime(ts), _ts: ts, gender: memberGenders.value[reg.user_id] || null, _regId: reg.id, _memberType: 'self', _guestIndex: -1, paidCourt: reg.paid_court ?? false, paidAc: reg.paid_ac ?? false })
    }
    ;(reg.guests || []).forEach((guest, gIdx) => {
      const ts = guest.added_at || reg.created_at
      const entry = { name: guest.name || '群外', badge: (guest.name || '群').charAt(0), time: formatRegistrationTime(ts), addedBy: reg.display_name, _ts: ts, gender: guest.gender || null, _regId: reg.id, _memberType: 'guest', _guestIndex: gIdx, paidCourt: guest.paid_court ?? false, paidAc: guest.paid_ac ?? false }
      if (gIdx >= 2) {
        overflowGuests.push(entry)
      } else {
        members.push(entry)
      }
    })
  })
  members.sort((a, b) => new Date(a._ts) - new Date(b._ts))
  overflowGuests.sort((a, b) => new Date(a._ts) - new Date(b._ts))
  const all = [...members, ...overflowGuests]
  return all.map(({ _ts, ...m }, i) => ({ ...m, status: i >= capacity ? '候補' : undefined }))
})

const cancelledMemberList = computed(() => {
  const members = []

  // Supabase 抓得到的整筆 cancelled 紀錄
  cancelledRegistrations.value.forEach(reg => {
    if (reg.self_count > 0) {
      members.push({ name: reg.display_name, badge: reg.display_name.charAt(0), image: reg.picture_url || null, time: formatRegistrationTime(reg.self_added_at || reg.created_at) })
    }
    ;(reg.guests || []).forEach(guest => {
      members.push({ name: guest.name || '群外', badge: (guest.name || '群').charAt(0), time: formatRegistrationTime(guest.added_at || reg.created_at), addedBy: reg.display_name })
    })
  })

  // 本地追蹤的取消成員（管理員個別移除 / 自己把「我」調回 0 但整筆未取消）
  localCancelledMembers.value.forEach(m => members.push(m))

  return members
})

const leaveMemberList = computed(() => {
  if (activityType.value === 'season') return []
  const date = resolvedDate.value
  if (!date) return []
  return seasonRegistrations.value
    .filter(reg => (reg.leave_dates || []).includes(date))
    .map(reg => ({
      name: reg.display_name,
      badge: reg.display_name.charAt(0),
      image: reg.picture_url || null,
    }))
})

const myFullyPaid = computed(() => {
  if (!hasSubmittedSignup.value) return false
  const reg = myRegistration.value
  if (!reg) return false

  if ((reg.self_count || 0) > 0) {
    if (!reg.paid_court) return false
    if (acEnabled.value && !reg.paid_ac) return false
  }

  for (const guest of (reg.guests || [])) {
    if (!guest.paid_court) return false
    if (acEnabled.value && !guest.paid_ac) return false
  }

  return true
})

async function togglePayment(member, field) {
  const regIdx = registrations.value.findIndex(r => r.id === member._regId)
  if (regIdx === -1) return
  const reg = registrations.value[regIdx]

  // 樂觀更新：立即反映 UI，不等 DB
  let updatedReg
  if (member._memberType === 'self') {
    updatedReg = { ...reg, [field]: !(reg[field] ?? false) }
  } else {
    const newGuests = (reg.guests || []).map((g, i) =>
      i === member._guestIndex ? { ...g, [field]: !(g[field] ?? false) } : g
    )
    updatedReg = { ...reg, guests: newGuests }
  }
  registrations.value = registrations.value.map((r, i) => i === regIdx ? updatedReg : r)

  // 背景寫入 DB，完成後再同步一次確保一致
  try {
    if (member._memberType === 'self') {
      await supabase.from('registrations').update({ [field]: updatedReg[field] }).eq('id', reg.id)
    } else {
      await supabase.from('registrations').update({ guests: updatedReg.guests }).eq('id', reg.id)
    }
    await fetchRegistrations()
  } catch {
    await fetchRegistrations()
  }
}

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
        await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', reg.id)
        await fetchRegistrations()
        if (!cancelledRegistrations.value.find(r => r.id === reg.id)) {
          localCancelledMembers.value = [...localCancelledMembers.value, { name: reg.display_name, badge: reg.display_name.charAt(0), image: reg.picture_url || null, time: formatRegistrationTime(reg.self_added_at || reg.created_at) }]
        }
        return
      } else {
        // 有群外：只把本人移出，記入取消清單
        localCancelledMembers.value = [...localCancelledMembers.value, { name: reg.display_name, badge: reg.display_name.charAt(0), image: reg.picture_url || null, time: formatRegistrationTime(reg.self_added_at || reg.created_at) }]
        await supabase.from('registrations').update({ self_count: 0, self_added_at: null }).eq('id', reg.id)
      }
    } else if (member._memberType === 'guest') {
      const removedGuest = (reg.guests || [])[member._guestIndex]
      const newGuests = (reg.guests || []).filter((_, i) => i !== member._guestIndex)
      const newGuestCount = newGuests.length
      if ((reg.self_count || 0) === 0 && newGuestCount === 0) {
        await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', reg.id)
        await fetchRegistrations()
        if (!cancelledRegistrations.value.find(r => r.id === reg.id)) {
          if (removedGuest) localCancelledMembers.value = [...localCancelledMembers.value, { name: removedGuest.name || '群外', badge: (removedGuest.name || '群').charAt(0), time: formatRegistrationTime(removedGuest.added_at || reg.created_at), addedBy: reg.display_name }]
        }
        return
      } else {
        if (removedGuest) localCancelledMembers.value = [...localCancelledMembers.value, { name: removedGuest.name || '群外', badge: (removedGuest.name || '群').charAt(0), time: formatRegistrationTime(removedGuest.added_at || reg.created_at), addedBy: reg.display_name }]
        await supabase.from('registrations').update({ guests: newGuests, guest_count: newGuestCount }).eq('id', reg.id)
      }
    }
    await fetchRegistrations()
  } catch {
    // 靜默失敗，名單資料不變
  }
}
async function updateAcEnabled(enabled) {
  acEnabled.value = enabled
  const activityId = route.query.id || activityData.value?.id
  if (!activityId) return
  try {
    await supabase.from('activities').update({ ac_enabled: enabled }).eq('id', activityId)
  } catch {
    // 靜默失敗，欄位可能尚未建立
  }
}

const SEGMENT_TABS = computed(() => {
  if (activityType.value === 'season') return ['全部']
  return ['臨打', '季打', '報名成功']
})

const filteredMemberList = computed(() => {
  if (activeSegment.value === '臨打') return memberList.value.filter(m => !m.isSeason)
  if (activeSegment.value === '季打') return memberList.value.filter(m => m.isSeason)
  if (activeSegment.value === '報名成功') return memberList.value.filter(m => !m.status)
  return memberList.value
})
const GENDER_OPTIONS = [
  { value: '', label: '性別', disabled: true },
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
]

const activeSegment = ref('臨打')
const signupOpen = ref(false)
const isSubmitting = ref(false)
const showGuestValidation = ref(false)
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

// 臨打頁面：季打成員（非請假）也視為已報名
const hasSubmittedSignup = computed(() => {
  if (activityType.value === 'season') return submittedTotal.value > 0
  if (submittedTotal.value > 0) return true
  if (isSeasonLeaveMode.value) {
    const isOnLeave = (mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value)
    return !isOnLeave
  }
  return false
})

const summaryFee = computed(() => submittedTotal.value * summaryFeeAmount.value)
const summaryStatusText = computed(() => {
  if (activityType.value === 'season') {
    return submittedTotal.value > 0 ? `已報名 ${submittedTotal.value} 位` : '未報名'
  }
  if (isSeasonLeaveMode.value && submittedTotal.value === 0) {
    const isOnLeave = (mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value)
    return isOnLeave ? '已請假' : '季打成員'
  }
  return hasSubmittedSignup.value ? `成功卡位 ${submittedTotal.value} 位` : '無報名'
})
const summaryFeeLabel = computed(() => {
  if (hasSubmittedSignup.value) {
    const stateText = myFullyPaid.value ? '已繳' : '未繳'
    return `費用 ${summaryFee.value} 元，${stateText}`
  }
  return `費用 ${summaryFeeAmount.value} 元`
})
const heroCtaText = computed(() => {
  if (activityType.value === 'season') return submittedTotal.value > 0 ? '管理報名' : '我要報名'
  if (isSeasonLeaveMode.value) return '管理報名'
  return hasSubmittedSignup.value ? '管理報名' : '我要報名'
})
const isSignupChanged = computed(() => {
  if (isSeasonLeaveMode.value) {
    const isOnLeave = (mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value)
    const selfChanged = (signupState.self === 0) !== isOnLeave
    const prevGuest = myRegistration.value?.guest_count ?? 0
    const prevGuests = myRegistration.value?.guests ?? []
    if (selfChanged || signupState.guest !== prevGuest) return true
    for (let i = 0; i < signupState.guest; i++) {
      const cur = signupState.guests[i] || { name: '', gender: '' }
      const prev = prevGuests[i] || { name: '', gender: '' }
      if ((cur.name || '') !== (prev.name || '') || (cur.gender || '') !== (prev.gender || '')) return true
    }
    return false
  }

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
  if (isOpen && !liffStore.userId) {
    if (liffStore.isExternalBrowser) {
      startLineOAuth()
    } else {
      liffStore.login()
    }
    return
  }

  const { restoreFocus = true } = options
  signupOpen.value = isOpen

  if (isOpen) {
    showGuestValidation.value = false
    if (isSeasonLeaveMode.value) {
      // 臨打頁面的季打成員：預填請假狀態，同時載入已有的群外資料
      const isOnLeave = (mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value)
      signupState.self = isOnLeave ? 0 : 1
      signupState.guest = myRegistration.value?.guest_count || 0
      signupState.guests = (myRegistration.value?.guests || []).map(g => ({ name: g.name || '', gender: g.gender || '', added_at: g.added_at || null }))
      while (signupState.guests.length < signupState.guest) signupState.guests.push({ name: '', gender: '', added_at: new Date().toISOString() })
    } else if (myRegistration.value) {
      // 預填現有報名資料
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
  if (isSubmitting.value) return
  isSubmitting.value = true
  try {
    await _doSubmitSignup()
  } finally {
    isSubmitting.value = false
  }
}

async function _doSubmitSignup() {
  // 等待 LIFF 完整初始化，避免 race condition 導致 userId 還沒就緒就被判斷為未登入
  await liffStore.initialize()

  if (!liffStore.userId) {
    if (liffStore.isExternalBrowser) {
      setSuccessDialogOpen(true, {
        title: '請先登入',
        copy: '需要以 LINE 帳號登入才能送出報名，點擊下方按鈕前往 LINE 登入。',
        buttonText: '以 LINE 登入',
        onButtonClick: () => startLineOAuth(),
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

  if (!isRegistrationOpen.value) {
    const openTimeStr = registrationOpenAt.value
      ? registrationOpenAt.value.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' })
      : '—'
    setSuccessDialogOpen(true, {
      title: '報名尚未開放',
      copy: `報名將於 ${openTimeStr} 開放，你可以先填好資料，時間到再送出。`,
      buttonText: '知道了',
    })
    return
  }

  // 季打請假模式（臨打頁面的季打成員）：同時處理請假狀態與群外臨打報名
  if (isSeasonLeaveMode.value) {
    const seasonReg = mySeasonRegistration.value
    const isCurrentlyOnLeave = (seasonReg?.leave_dates || []).includes(resolvedDate.value)
    const newSelf = signupState.self

    const missingGender = signupState.guests.slice(0, signupState.guest).some(g => !g.gender)
    if (missingGender) {
      showGuestValidation.value = true
      setSuccessDialogOpen(true, {
        title: '請選擇性別',
        copy: '每位群外朋友都需要選擇性別，請補齊後再送出。',
        buttonText: '回去填寫',
      })
      return
    }

    try {
      const leaveStatusChanged = (newSelf === 0) !== isCurrentlyOnLeave

      // 更新請假狀態
      if (leaveStatusChanged) {
        const newLeaveDates = newSelf === 0
          ? [...(seasonReg.leave_dates || []), resolvedDate.value]
          : (seasonReg.leave_dates || []).filter(d => d !== resolvedDate.value)
        await supabase.from('registrations').update({ leave_dates: newLeaveDates }).eq('id', seasonReg.id)
      }

      // 處理群外臨打報名
      const guestTotal = signupState.guest
      const prevGuestTotal = myRegistration.value?.guest_count ?? 0
      const prevGuests = myRegistration.value?.guests ?? []
      const submitTime = new Date().toISOString()

      if (guestTotal > 0) {
        const guestsWithTime = signupState.guests.slice(0, guestTotal).map((g, i) => ({
          ...g,
          added_at: i < prevGuests.length ? (prevGuests[i].added_at || submitTime) : submitTime,
        }))
        const payload = {
          activity_id: activityData.value?.id,
          activity_date: resolvedDate.value,
          user_id: liffStore.userId,
          display_name: liffStore.displayName,
          picture_url: liffStore.pictureUrl || null,
          self_count: 0,
          self_added_at: null,
          guest_count: guestTotal,
          guests: guestsWithTime,
          status: 'active',
        }
        if (myRegistration.value) {
          await supabase.from('registrations').update(payload).eq('id', myRegistration.value.id)
        } else {
          await supabase.from('registrations').insert(payload)
        }
      } else if (myRegistration.value && prevGuestTotal > 0) {
        // 群外全部清空，取消那筆臨打報名
        await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', myRegistration.value.id)
      }

      await fetchRegistrations()
      setSignupOpen(false, { restoreFocus: false })

      let title, copy
      if (leaveStatusChanged && guestTotal === 0) {
        title = newSelf === 0 ? '已請假' : '已取消請假'
        copy = newSelf === 0 ? '已為此場次請假，名額將釋出給臨打。' : '已取消請假，你將重新加入此場次名單。'
      } else {
        title = '已更新'
        copy = '出席狀態與群外報名已更新。'
      }
      setSuccessDialogOpen(true, { title, copy, buttonText: '確認' })
    } catch {
      setSuccessDialogOpen(true, { title: '操作失敗', copy: '請稍後再試。', buttonText: '確認' })
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

  const missingGender = signupState.guests.slice(0, signupState.guest).some(g => !g.gender)
  if (missingGender) {
    showGuestValidation.value = true
    setSuccessDialogOpen(true, {
      title: '請選擇性別',
      copy: '每位群外朋友都需要選擇性別，請補齊後再送出。',
      buttonText: '回去填寫',
    })
    return
  }

  // 取消報名：標記為 cancelled，保留紀錄顯示於名單底部
  if (total <= 0 && myRegistration.value) {
    try {
      const cancellingReg = myRegistration.value
      await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', cancellingReg.id)
      await fetchRegistrations()
      if (!cancelledRegistrations.value.find(r => r.id === cancellingReg.id)) {
        localCancelledMembers.value = [...localCancelledMembers.value, { name: cancellingReg.display_name, badge: cancellingReg.display_name.charAt(0), image: cancellingReg.picture_url || null, time: formatRegistrationTime(cancellingReg.self_added_at || cancellingReg.created_at) }]
        ;(cancellingReg.guests || []).forEach(g => {
          localCancelledMembers.value = [...localCancelledMembers.value, { name: g.name || '群外', badge: (g.name || '群').charAt(0), time: formatRegistrationTime(g.added_at || cancellingReg.created_at), addedBy: cancellingReg.display_name }]
        })
      }
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
    activity_date: activityType.value === 'season' ? null : resolvedDate.value,
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
    // 「我」從有報名變成沒報名（整筆未取消，例如還有群外），補進本地取消清單
    if (prevSelfCount > 0 && signupState.self === 0 && myRegistration.value) {
      const reg = myRegistration.value
      localCancelledMembers.value = [...localCancelledMembers.value, { name: reg.display_name, badge: reg.display_name.charAt(0), image: reg.picture_url || null, time: formatRegistrationTime(reg.self_added_at || reg.created_at) }]
    }
    // 群外人數減少時，把被移除的群外朋友加進取消清單
    if (!isNewRegistration && signupState.guest < prevGuests.length) {
      const removedGuests = prevGuests.slice(signupState.guest)
      const addedByName = myRegistration.value?.display_name || liffStore.displayName
      removedGuests.forEach(g => {
        localCancelledMembers.value = [...localCancelledMembers.value, { name: g.name || '群外', badge: (g.name || '群').charAt(0), time: formatRegistrationTime(g.added_at), addedBy: addedByName }]
      })
    }
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

// 季打頁面一鍵報名（不開 Drawer）
const seasonCancelOpen = ref(false)

async function handleCtaClick() {
  if (activityType.value === 'season') {
    if (hasSubmittedSignup.value) {
      seasonCancelOpen.value = true
      return
    }
    await directSeasonRegister()
    return
  }
  setSignupOpen(true)
}

async function directSeasonRegister() {
  await liffStore.initialize()

  if (!liffStore.userId) {
    if (liffStore.isExternalBrowser) startLineOAuth()
    else liffStore.login()
    return
  }

  if (!isRegistrationOpen.value) {
    const openTimeStr = registrationOpenAt.value
      ? registrationOpenAt.value.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' })
      : '—'
    setSuccessDialogOpen(true, {
      title: '報名尚未開放',
      copy: `季打報名將於 ${openTimeStr} 開放。`,
      buttonText: '知道了',
    })
    return
  }

  if (isSubmitting.value) return
  isSubmitting.value = true
  try {
    const submitTime = new Date().toISOString()
    const payload = {
      activity_id: activityData.value?.id,
      activity_date: null,
      user_id: liffStore.userId,
      display_name: liffStore.displayName,
      picture_url: liffStore.pictureUrl || null,
      self_count: 1,
      self_added_at: submitTime,
      guest_count: 0,
      guests: [],
      status: 'active',
    }
    if (myRegistration.value) {
      await supabase.from('registrations').update(payload).eq('id', myRegistration.value.id)
    } else if (myCancelledSeasonRegistration.value) {
      // 重新加回已取消的季打報名
      await supabase.from('registrations').update(payload).eq('id', myCancelledSeasonRegistration.value.id)
    } else {
      await supabase.from('registrations').insert(payload)
    }
    await fetchRegistrations()
  } catch {
    setSuccessDialogOpen(true, { title: '報名失敗', copy: '送出時發生錯誤，請稍後再試。', buttonText: '確認' })
  } finally {
    isSubmitting.value = false
  }
}

async function confirmSeasonCancel() {
  seasonCancelOpen.value = false
  const reg = myRegistration.value
  if (!reg) return
  try {
    await supabase.from('registrations').update({ status: 'cancelled' }).eq('id', reg.id)
    await fetchRegistrations()
  } catch {
    setSuccessDialogOpen(true, { title: '取消失敗', copy: '請稍後再試。', buttonText: '確認' })
  }
}

function handleEscape() {
  if (seasonCancelOpen.value) {
    seasonCancelOpen.value = false
    return
  }
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
  <div v-if="activityNotFound" class="not-found-page">
    <div class="not-found-content">
      <p class="not-found-icon" aria-hidden="true">🏐</p>
      <h1 class="not-found-title">此球局已被移除</h1>
      <p class="not-found-desc">你開啟的球局連結已不存在，可能已被主揪刪除。</p>
      <button class="not-found-btn" type="button" @click="router.replace('/')">回到首頁</button>
    </div>
  </div>

  <main v-else class="active-activity-page" :class="[{ 'signup-open': signupOpen }, `hero-${activityType}`]" @keydown.esc="handleEscape">
    <Teleport v-if="isAdmin" to="#nav-extra">
      <button
        class="admin-mode-toggle"
        :class="{ 'is-active': adminMode }"
        type="button"
        :aria-pressed="String(adminMode)"
        @click="adminMode = !adminMode"
      >
        <span class="admin-mode-dot"></span>
        管理
      </button>
    </Teleport>
    <section class="hero">
      <img v-if="activityType === 'latest' || activityType === 'season'" class="hero-cat" src="/images/cat-hide.png" alt="" aria-hidden="true" />
      <div class="hero-layout">
        <div class="hero-copy">
          <h1>{{ heroTitle }}</h1>
        </div>
      </div>
    </section>

    <ActivitySummaryCard
      :date="activityType === 'season' ? '' : summaryDate"
      :weekday="activityType === 'season' ? '' : summaryWeekday"
      :time="summaryTime"
      :location="summaryLocation"
      :session-count="activityType === 'season' ? activitySessionCount : 0"
      status-label="狀態"
      :status-value="summaryStatusText"
      :status-tone="hasSubmittedSignup ? 'success' : 'default'"
      :fee-amount="activityType === 'season' ? summaryFeeAmount : (hasSubmittedSignup ? summaryFee : summaryFeeAmount)"
      :fee-state="activityType !== 'season' && hasSubmittedSignup ? (myFullyPaid ? '已繳' : '未繳') : ''"
      :fee-state-tone="hasSubmittedSignup && myFullyPaid ? 'success' : 'default'"
      :fee-aria-label="summaryFeeLabel"
      :vacancy-label="activityType === 'season' ? '季打缺' : '臨打缺'"
      :vacancy-value="vacancyCount"
      :vacancy-tone="activityType === 'season' ? 'orange' : 'teal'"
      :is-admin="isAdmin"
      :ac-enabled="acEnabled"
      @update:ac-enabled="updateAcEnabled"
      @view-dates="showAllDatesDialog = true"
    />

    <ActivityMemberSection :tabs="SEGMENT_TABS" :active-segment="activeSegment" :members="filteredMemberList" :bottom-spacing="(isLoading || filteredMemberList.length === 0) ? 0 : (cancelledMemberList.length > 0 || leaveMemberList.length > 0 ? 0 : 100)" :is-admin="isAdmin" :admin-mode="adminMode" :ac-enabled="acEnabled" @change="setSegmentTab" @remove="handleRemoveRequest" @toggle-payment="togglePayment" />
    <div v-if="isLoading && filteredMemberList.length === 0" class="member-skeleton" aria-hidden="true">
      <div v-for="i in 7" :key="i" class="member-skeleton-row">
        <div class="skel skel-rank"></div>
        <div class="skel skel-avatar"></div>
        <div class="skel-text">
          <div class="skel skel-name"></div>
          <div class="skel skel-time"></div>
        </div>
      </div>
    </div>
    <p v-else-if="!isLoading && filteredMemberList.length === 0" class="empty-member-hint">目前尚無報名資料</p>

    <div v-if="cancelledMemberList.length > 0 && (activityType === 'season' || activeSegment === '臨打')" class="cancelled-section">
      <div class="cancelled-divider">
        <span class="cancelled-divider-label">{{ activityType === 'season' ? '已取消季打' : '已取消報名' }}</span>
      </div>
      <div class="cancelled-list">
        <div v-for="(member, index) in cancelledMemberList" :key="`cancelled-${member.name}-${index}`" class="cancelled-row">
          <div class="cancelled-avatar">
            <img v-if="member.image" :src="member.image" alt="" />
            <template v-else>{{ member.badge }}</template>
          </div>
          <div class="cancelled-info">
            <span class="cancelled-name">{{ member.name }}</span>
            <span v-if="member.time || member.addedBy" class="cancelled-meta">
              {{ member.time }}<template v-if="member.time && member.addedBy"> · </template>{{ member.addedBy }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="leaveMemberList.length > 0 && activeSegment === '季打'" class="cancelled-section">
      <div class="cancelled-divider">
        <span class="cancelled-divider-label">已請假</span>
      </div>
      <div class="cancelled-list">
        <div v-for="(member, index) in leaveMemberList" :key="`leave-${member.name}-${index}`" class="cancelled-row">
          <div class="cancelled-avatar">
            <img v-if="member.image" :src="member.image" alt="" />
            <template v-else>{{ member.badge }}</template>
          </div>
          <div class="cancelled-info">
            <span class="cancelled-name">{{ member.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activityType !== 'ended' && !adminMode" class="footer-bar">
      <div class="footer-fade"></div>
      <button ref="heroCtaButton" class="cta" type="button" :disabled="isSubmitting" @click="handleCtaClick">{{ isSubmitting ? '處理中...' : heroCtaText }}</button>
    </div>

    <div class="signup-overlay phone-container modal-frame" :class="{ 'is-open': signupOpen }" :aria-hidden="String(!signupOpen)" :inert="!signupOpen">
      <button class="signup-backdrop" type="button" aria-label="關閉報名表" @click="setSignupOpen(false)"></button>
      <section class="signup-sheet" role="dialog" aria-modal="true" aria-labelledby="signup-sheet-title">
        <div class="signup-sheet-header">
          <h2 class="signup-sheet-title" id="signup-sheet-title">{{ isSeasonLeaveMode ? '季打出席管理' : '報名此球局' }}</h2>
          <span v-if="!isSeasonLeaveMode" class="prefill-tag">可預填</span>
          <span v-else class="prefill-tag" style="background: rgba(255,230,190,0.85); color: #c87416;">請假 = 0</span>
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
                  <button class="stepper-btn" type="button" :disabled="isAdmin ? signupState.guest >= 6 : signupState.guest >= 2" aria-label="增加群外報名人數" @click="adjustSignupCount('guest', 1)">
                    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M7 3V11M3 7H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="guest-fields" aria-live="polite">
                <p v-if="!isAdmin && signupState.guest > 2" class="guest-over-limit-notice">每人限帶 2 位優先報名，超過 2 位將依序遞補</p>
                <div v-for="(guest, index) in signupState.guests" :key="index" class="guest-row">
                  <input v-model="guest.name" class="guest-input" type="text" :name="`guest-name-${index + 1}`" placeholder="群外朋友姓名" :aria-label="`第 ${index + 1} 位群外朋友姓名`" />
                  <select v-model="guest.gender" class="guest-select" :class="{ 'is-error': showGuestValidation && !guest.gender }" :name="`guest-gender-${index + 1}`" required :aria-label="`第 ${index + 1} 位群外朋友性別`">
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
          <button ref="confirmSignupButton" class="confirm-signup" type="button" :disabled="!isRegistrationOpen || isSubmitting || !isSignupChanged" @click="submitSignup">確認報名</button>
          <p v-if="registrationCountdown" class="signup-countdown">{{ registrationCountdown }}</p>
          <p v-else class="signup-note">送出不代表報名成功，請以名單為準</p>
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

    <!-- 取消季打報名確認 sheet -->
    <div class="season-cancel-overlay phone-container modal-frame" :class="{ 'is-open': seasonCancelOpen }" :aria-hidden="String(!seasonCancelOpen)" :inert="!seasonCancelOpen" @click.self="seasonCancelOpen = false">
      <section class="season-cancel-sheet" role="dialog" aria-modal="true">
        <p class="season-cancel-title">確認取消季打報名？</p>
        <p class="season-cancel-copy">取消後你將從季打名單中移除，名額將釋出給其他人。</p>
        <div class="season-cancel-actions">
          <button class="season-cancel-btn is-muted" type="button" @click="seasonCancelOpen = false">保留報名</button>
          <button class="season-cancel-btn is-danger" type="button" @click="confirmSeasonCancel">確認取消</button>
        </div>
      </section>
    </div>

    <!-- 查看所有日期 Dialog -->
    <div class="all-dates-overlay phone-container modal-frame" :class="{ 'is-open': showAllDatesDialog }" :aria-hidden="String(!showAllDatesDialog)" :inert="!showAllDatesDialog" @click.self="showAllDatesDialog = false">
      <section class="all-dates-sheet" role="dialog" aria-modal="true" aria-labelledby="all-dates-title">
        <div class="all-dates-header">
          <h2 id="all-dates-title" class="all-dates-title">所有場次日期</h2>
          <span class="all-dates-count">共 {{ activitySessionCount }} 次</span>
        </div>
        <div class="all-dates-list">
          <div v-for="(date, i) in (activityData?.dates || [])" :key="date" class="all-dates-row">
            <span class="all-dates-index">{{ i + 1 }}</span>
            <span class="all-dates-label">{{ formatAllDate(date) }}</span>
          </div>
        </div>
        <div class="all-dates-actions">
          <button class="all-dates-close-btn" type="button" @click="showAllDatesDialog = false">關閉</button>
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

.active-activity-page.hero-season {
  background: linear-gradient(180deg, #c87416 0%, #d4820f 7%, #e09a3a 13%, #f0bf78 20%, #fae1b8 27%, #fff 35%, #fff 100%);
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

.guest-over-limit-notice {
  margin: 0;
  padding: 8px 10px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 8px;
  font-size: 13px;
  color: #ad6800;
  line-height: 1.5;
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

.guest-select.is-error {
  border-color: #d14343;
  box-shadow: 0 0 0 3px rgba(209, 67, 67, 0.12);
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

.member-skeleton {
  padding: 0 16px 100px;
  display: flex;
  flex-direction: column;
}

.member-skeleton-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
}

.skel-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skel {
  border-radius: 6px;
  background: linear-gradient(90deg, #eef0f6 25%, #e4e6ef 50%, #eef0f6 75%);
  background-size: 200% 100%;
  animation: skel-shimmer 1.4s ease infinite;
}

.skel-rank {
  width: 18px;
  height: 14px;
  flex: 0 0 auto;
  border-radius: 4px;
}

.skel-avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.skel-name {
  height: 14px;
  width: 55%;
}

.skel-time {
  height: 12px;
  width: 35%;
}

@keyframes skel-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.cancelled-section {
  padding: 0 16px 110px;
}

.cancelled-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0;
}

.cancelled-divider::before,
.cancelled-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e4e7f0;
}

.cancelled-divider-label {
  color: #8f95b2;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 500;
  white-space: nowrap;
}

.cancelled-list {
  display: grid;
}

.cancelled-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
}

.cancelled-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e4e7f0;
  color: #8f95b2;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: 0 0 auto;
  opacity: 0.6;
}

.cancelled-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cancelled-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cancelled-name {
  font-size: 14px;
  color: #8f95b2;
  line-height: 1.4;
}

.cancelled-meta {
  font-size: 12px;
  color: #b0b5cc;
  line-height: 1.4;
  margin-top: 1px;
}

.not-found-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #e8e9f5 0%, #fff 40%, #fff 100%);
  padding: 32px 24px;
}

.not-found-content {
  text-align: center;
  max-width: 280px;
}

.not-found-icon {
  font-size: 52px;
  margin: 0 0 20px;
  line-height: 1;
}

.not-found-title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 700;
  color: #101840;
  line-height: 1.4;
}

.not-found-desc {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.6;
  color: #696f8c;
}

.not-found-btn {
  width: 100%;
  min-height: 48px;
  border-radius: 12px;
  background: #5768ff;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.season-cancel-overlay {
  position: fixed;
  z-index: 10002;
  overflow: hidden;
  margin: auto;
  display: none;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.4);
}

.season-cancel-overlay.is-open {
  display: flex;
}

.season-cancel-sheet {
  width: 100%;
  padding: 28px 20px 24px;
  border-radius: 18px 18px 0 0;
  background: #fff;
}

.season-cancel-title {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
  color: #101840;
  line-height: 1.36;
}

.season-cancel-copy {
  margin: 0 0 24px;
  font-size: 14px;
  color: #474d66;
  line-height: 1.6;
}

.season-cancel-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.season-cancel-btn {
  min-height: 48px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
}

.season-cancel-btn.is-muted {
  background: #f4f6fa;
  color: #474d66;
}

.season-cancel-btn.is-danger {
  background: #d14343;
  color: #fff;
}

.all-dates-overlay {
  position: fixed;
  z-index: 10002;
  overflow: hidden;
  margin: auto;
  display: none;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.4);
}

.all-dates-overlay.is-open {
  display: flex;
}

.all-dates-sheet {
  width: 100%;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  border-radius: 18px 18px 0 0;
  background: #fff;
}

.all-dates-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #f0f1f7;
}

.all-dates-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.36;
  font-weight: 600;
  color: #101840;
}

.all-dates-count {
  font-size: 14px;
  color: #8f95b2;
  font-weight: 400;
}

.all-dates-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 20px;
  -webkit-overflow-scrolling: touch;
}

.all-dates-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid #f4f6fa;
}

.all-dates-row:last-child {
  border-bottom: none;
}

.all-dates-index {
  width: 24px;
  font-size: 13px;
  font-weight: 600;
  color: #c87416;
  text-align: center;
  flex: 0 0 auto;
}

.all-dates-label {
  font-size: 15px;
  color: #101840;
  line-height: 1.4;
}

.all-dates-actions {
  flex: 0 0 auto;
  padding: 14px 20px 20px;
  border-top: 1px solid #f0f1f7;
}

.all-dates-close-btn {
  width: 100%;
  min-height: 48px;
  border-radius: 10px;
  background: #f4f6fa;
  color: #474d66;
  font-size: 16px;
  font-weight: 500;
}

@media (min-width: 768px) {
  .footer-bar {
    bottom: 24px;
    border-radius: 0 0 1.5rem 1.5rem;
    overflow: hidden;
  }
}
</style>

<style>
.admin-mode-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  border: 1.5px solid rgba(255, 255, 255, 0.45);
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.admin-mode-toggle.is-active {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.9);
  color: #fff;
}

.admin-mode-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  flex: 0 0 auto;
  transition: background 0.2s ease;
}

.admin-mode-toggle.is-active .admin-mode-dot {
  background: #1bc4bf;
}

.nav.is-scrolled .admin-mode-toggle {
  border-color: rgba(87, 104, 255, 0.35);
  color: #5768ff;
}

.nav.is-scrolled .admin-mode-toggle.is-active {
  background: rgba(87, 104, 255, 0.08);
  border-color: rgba(87, 104, 255, 0.6);
  color: #5768ff;
}

.nav.is-scrolled .admin-mode-dot {
  background: rgba(87, 104, 255, 0.3);
}

.nav.is-scrolled .admin-mode-toggle.is-active .admin-mode-dot {
  background: #1bc4bf;
}
</style>
