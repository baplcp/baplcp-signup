import { computed } from 'vue'
import { pickupGuestPriorityCutoff, sortPickupParticipants } from '~/utils/pickupPriority'
import { seasonPlanCoversDate } from '~/utils/seasonPlan'

function formatRegistrationTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${month}/${day} ${h}:${m}:${s}`
}

function registrationSelfEntry(reg, memberType, timestamp, memberGenders, options = {}) {
  return {
    name: reg.display_name,
    badge: reg.display_name.charAt(0),
    image: reg.picture_url || null,
    time: formatRegistrationTime(timestamp),
    _ts: timestamp,
    gender: memberGenders[reg.user_id] || null,
    _regId: reg.id,
    _memberType: memberType,
    _guestIndex: -1,
    paidCourt: reg.paid_court ?? false,
    paidAc: reg.paid_ac ?? false,
    ...options,
  }
}

function guestEntry(reg, guest) {
  const ts = guest.created_at || reg.created_at
  return {
    name: guest.name || '群外',
    badge: (guest.name || '群').charAt(0),
    time: formatRegistrationTime(ts),
    addedBy: reg.display_name,
    _ts: ts,
    gender: guest.gender || null,
    _regId: reg.id,
    _memberType: 'guest',
    _guestId: guest.id,
    isGuest: true,
    paidCourt: guest.paid_court ?? false,
    paidAc: guest.paid_ac ?? false,
  }
}

function cancelledSelfEntry(reg) {
  return {
    name: reg.display_name,
    badge: reg.display_name.charAt(0),
    image: reg.picture_url || null,
    time: formatRegistrationTime(reg.cancelled_at),
    _ts: reg.cancelled_at,
  }
}

function cancelledGuestEntry(reg, guest) {
  return {
    name: guest.name || '群外',
    badge: (guest.name || '群').charAt(0),
    time: formatRegistrationTime(guest.cancelled_at),
    addedBy: reg.display_name,
    _ts: guest.cancelled_at,
  }
}

export function useActivityMemberLists({ activityData, activityType, resolvedDate, registrations, cancelledRegistrations, seasonRegistrations, memberGenders }) {
  // 季打成員只出現在自己方案涵蓋的場次，例如一季的人不會出現在後三個月。
  const seasonRegistrationsForDate = computed(() => seasonRegistrations.value.filter(reg => seasonPlanCoversDate(reg.season_plan, resolvedDate.value, activityData.value?.dates)))

  const memberList = computed(() => {
    const capacity = activityData.value?.single_capacity ?? Infinity
    const members = []

    if (activityType.value !== 'season') {
      const date = resolvedDate.value
      seasonRegistrationsForDate.value.forEach(reg => {
        if ((reg.leave_dates || []).includes(date)) return
        if (!reg.cancelled_at && reg.is_self_registration) {
          const rejoinedAt = reg.rejoin_times?.[date]
          const ts = rejoinedAt || reg.created_at
          members.push(registrationSelfEntry(reg, 'season_self', ts, memberGenders.value, { isSeason: true, isRejoined: !!rejoinedAt }))
        }
      })
    } else {
      registrations.value.forEach(reg => {
        if (!reg.cancelled_at && reg.is_self_registration) {
          members.push(registrationSelfEntry(reg, 'self', reg.created_at, memberGenders.value, { seasonPlan: reg.season_plan }))
        }
      })
      members.sort((a, b) => new Date(a._ts) - new Date(b._ts))
      return members.map(({ _ts, ...member }, index) => ({ ...member, status: index >= (activityData.value?.single_capacity ?? Infinity) ? '候補' : undefined }))
    }

    registrations.value.forEach(reg => {
      if (!reg.cancelled_at && reg.is_self_registration) {
        members.push(registrationSelfEntry(reg, 'self', reg.created_at, memberGenders.value))
      }

      ;(reg.guests || []).forEach(guest => {
        if (!guest.cancelled_at) members.push(guestEntry(reg, guest))
      })
    })

    // 開放報名後第一個星期二 23:59 前，群內成員優先於群外朋友；之後依報名時間排序。
    const cutoff = pickupGuestPriorityCutoff(resolvedDate.value, activityData.value?.pickup_open_days_before)
    return sortPickupParticipants(members, cutoff).map(({ _ts, isGuest, ...member }, index) => ({ ...member, status: index >= capacity ? '候補' : undefined }))
  })

  const cancelledMemberList = computed(() => {
    const members = []

    cancelledRegistrations.value.forEach(reg => {
      if (reg.is_self_registration) members.push(cancelledSelfEntry(reg))
    })
    ;[...registrations.value, ...seasonRegistrations.value].forEach(reg => {
      ;(reg.guests || [])
        .filter(guest => guest.cancelled_at)
        .forEach(guest => {
          members.push(cancelledGuestEntry(reg, guest))
        })
    })

    return members.sort((a, b) => new Date(b._ts || 0) - new Date(a._ts || 0)).map(({ _ts, ...member }) => member)
  })

  const leaveMemberList = computed(() => {
    if (activityType.value === 'season') return []
    const date = resolvedDate.value
    if (!date) return []
    return (
      seasonRegistrationsForDate.value
        // 已取消的季打報名仍保留當時的請假紀錄，不應再列入請假名單
        .filter(reg => !reg.cancelled_at && (reg.leave_dates || []).includes(date))
        .map(reg => ({
          name: reg.display_name,
          badge: reg.display_name.charAt(0),
          image: reg.picture_url || null,
        }))
    )
  })

  return {
    memberList,
    cancelledMemberList,
    leaveMemberList,
  }
}
