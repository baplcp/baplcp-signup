import { computed } from 'vue'

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

function guestEntry(reg, guest, guestIndex) {
  const ts = guest.added_at || reg.created_at
  return {
    name: guest.name || '群外',
    badge: (guest.name || '群').charAt(0),
    time: formatRegistrationTime(ts),
    addedBy: reg.display_name,
    _ts: ts,
    gender: guest.gender || null,
    _regId: reg.id,
    _memberType: 'guest',
    _guestIndex: guestIndex,
    paidCourt: guest.paid_court ?? false,
    paidAc: guest.paid_ac ?? false,
  }
}

function cancelledSelfEntry(reg) {
  return {
    name: reg.display_name,
    badge: reg.display_name.charAt(0),
    image: reg.picture_url || null,
    time: formatRegistrationTime(reg.self_added_at || reg.created_at),
  }
}

function cancelledGuestEntry(reg, guest) {
  return {
    name: guest.name || '群外',
    badge: (guest.name || '群').charAt(0),
    time: formatRegistrationTime(guest.added_at || reg.created_at),
    addedBy: reg.display_name,
  }
}

function cancelledSnapshotEntry(member) {
  return {
    name: member.name || '群外',
    badge: member.badge || (member.name || '群').charAt(0),
    image: member.image || null,
    time: formatRegistrationTime(member.time),
    addedBy: member.addedBy || null,
  }
}

export function useActivityMemberLists({ activityData, activityType, resolvedDate, registrations, cancelledRegistrations, seasonRegistrations, memberGenders }) {
  const memberList = computed(() => {
    const capacity = activityData.value?.single_capacity ?? Infinity
    const members = []

    if (activityType.value !== 'season') {
      const date = resolvedDate.value
      seasonRegistrations.value.forEach(reg => {
        if ((reg.leave_dates || []).includes(date)) return
        if (reg.self_count > 0) {
          const rejoinedAt = reg.rejoin_times?.[date]
          const ts = rejoinedAt || reg.created_at
          members.push(registrationSelfEntry(reg, 'season_self', ts, memberGenders.value, { isSeason: true, isRejoined: !!rejoinedAt }))
        }
      })
    } else {
      registrations.value.forEach(reg => {
        if (reg.self_count > 0) {
          const ts = reg.self_added_at || reg.created_at
          members.push(registrationSelfEntry(reg, 'self', ts, memberGenders.value, { seasonPlan: reg.season_plan || 'quarter' }))
        }
      })
      members.sort((a, b) => new Date(a._ts) - new Date(b._ts))
      return members.map(({ _ts, ...member }, index) => ({ ...member, status: index >= (activityData.value?.single_capacity ?? Infinity) ? '候補' : undefined }))
    }

    const overflowGuests = []

    registrations.value.forEach(reg => {
      if (reg.self_count > 0) {
        const ts = reg.self_added_at || reg.created_at
        members.push(registrationSelfEntry(reg, 'self', ts, memberGenders.value))
      }

      ;(reg.guests || []).forEach((guest, guestIndex) => {
        const entry = guestEntry(reg, guest, guestIndex)
        if (guestIndex >= 2) {
          overflowGuests.push(entry)
        } else {
          members.push(entry)
        }
      })
    })

    members.sort((a, b) => new Date(a._ts) - new Date(b._ts))
    overflowGuests.sort((a, b) => new Date(a._ts) - new Date(b._ts))
    return [...members, ...overflowGuests].map(({ _ts, ...member }, index) => ({ ...member, status: index >= capacity ? '候補' : undefined }))
  })

  const cancelledMemberList = computed(() => {
    const activeUserIds = new Set(registrations.value.map(reg => reg.user_id))
    const members = []

    cancelledRegistrations.value.forEach(reg => {
      if (activeUserIds.has(reg.user_id)) return
      if (reg.self_count > 0) members.push(cancelledSelfEntry(reg))
      ;(reg.guests || []).forEach(guest => {
        members.push(cancelledGuestEntry(reg, guest))
      })
    })
    ;[...registrations.value, ...cancelledRegistrations.value.filter(reg => !activeUserIds.has(reg.user_id))].forEach(reg => {
      ;(reg.cancelled_members || []).forEach(member => {
        members.push(cancelledSnapshotEntry(member))
      })
    })

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

  return {
    memberList,
    cancelledMemberList,
    leaveMemberList,
  }
}
