import { computed, onMounted, ref } from 'vue'
import { listGroupActivities } from '~/services/activityService'
import { listRegistrationsForActivitySpots, listRegistrationsForLatestSpots } from '~/services/registrationService'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const SEGMENT_ALL = 'all'
const UPCOMING_PREVIEW_COUNT = 5
const ENDED_PREVIEW_COUNT = 5

export const groupListSegmentTabs = [
  { label: '全部', value: SEGMENT_ALL },
  { label: '最新球局', value: 'latest' },
  { label: '即將到來', value: 'upcoming' },
  { label: '已結束', value: 'ended' },
]

export function formatGroupDateLabel(dateStr) {
  const [, month, day] = dateStr.split('-')
  const weekday = WEEKDAYS[new Date(dateStr + 'T00:00:00').getDay()]
  return `${Number(month)}.${day} (${weekday})`
}

function formatTimeRange(startTime, endTime) {
  const fmt = time => (time || '').replace(/^0/, '').slice(0, 5)
  return `${fmt(startTime)}-${fmt(endTime)}`
}

function formatDateRow(dateStr, startTime, endTime) {
  return `${formatGroupDateLabel(dateStr)}｜${formatTimeRange(startTime, endTime)}`
}

function isDateExpired(dateStr, endTime, now) {
  if (!endTime) {
    const todayStr = now.toISOString().split('T')[0]
    return dateStr < todayStr
  }

  const [hours, minutes] = endTime.split(':').map(Number)
  const end = new Date(dateStr + 'T00:00:00')
  end.setHours(hours + 1, minutes, 0, 0)
  return now > end
}

function getSortedDates(activity) {
  return (activity.dates || []).slice().sort()
}

function createActivityRoute(activityId, dateStr, type) {
  return `/active-activity?id=${activityId}&date=${dateStr}&type=${type}`
}

// 季打報名（activity_date 為 null）當天請假就不占用名額，且季打報名不含來賓人數
function computeVacancy(registrations, dateStr, capacity) {
  const totalPeople = registrations.reduce((sum, registration) => {
    if (registration.activity_date === null) {
      if ((registration.leave_dates || []).includes(dateStr)) return sum
      return sum + (registration.self_count || 0)
    }
    if (registration.activity_date !== dateStr) return sum
    return sum + (registration.self_count || 0) + (registration.guest_count || 0)
  }, 0)
  return Math.max(0, (capacity || 0) - totalPeople)
}

export function useGroupListPage() {
  const activeSegment = ref(SEGMENT_ALL)
  const activities = ref([])
  const isLoading = ref(true)
  const latestSpots = ref(null)
  const upcomingSpots = ref({})
  const now = new Date()

  const latestInfo = computed(() => {
    const futureDates = []

    for (const activity of activities.value) {
      const nearestDate = getSortedDates(activity).find(dateStr => !isDateExpired(dateStr, activity.end_time, now))
      if (nearestDate) futureDates.push({ activity, date: nearestDate })
    }

    if (futureDates.length === 0) return null
    futureDates.sort((a, b) => a.date.localeCompare(b.date))
    return futureDates[0]
  })

  const latestActivity = computed(() => {
    if (!latestInfo.value) return null

    const { activity, date } = latestInfo.value
    const spots = latestSpots.value

    return {
      countLabel: '臨打缺',
      countValue: spots !== null ? spots : '—',
      countAriaLabel: `臨打缺 ${spots !== null ? spots : '—'} 人`,
      date: formatDateRow(date, activity.start_time, activity.end_time),
      location: activity.location || '—',
      to: createActivityRoute(activity.id, date, 'latest'),
    }
  })

  const upcomingActivities = computed(() => {
    if (!latestInfo.value) return []

    const { activity: latestActivityInfo, date: latestDate } = latestInfo.value
    const rows = []

    for (const activity of activities.value) {
      for (const dateStr of getSortedDates(activity)) {
        const isLatest = activity.id === latestActivityInfo.id && dateStr === latestDate
        if (!isDateExpired(dateStr, activity.end_time, now) && !isLatest) {
          rows.push({ activity, dateStr })
        }
      }
    }

    rows.sort((a, b) => a.dateStr.localeCompare(b.dateStr))
    return rows.map(({ activity, dateStr }) => {
      const vacancy = upcomingSpots.value[`${activity.id}_${dateStr}`]
      const locationText = activity.location || '—'
      return {
        date: formatDateRow(dateStr, activity.start_time, activity.end_time),
        location: vacancy !== undefined ? `缺 ${vacancy}・${locationText}` : locationText,
        to: createActivityRoute(activity.id, dateStr, 'upcoming'),
        badge: '未開放報名',
        badgeVariant: 'muted',
      }
    })
  })

  const endedActivities = computed(() => {
    const rows = []

    for (const activity of activities.value) {
      for (const dateStr of getSortedDates(activity)) {
        if (isDateExpired(dateStr, activity.end_time, now)) rows.push({ activity, dateStr })
      }
    }

    rows.sort((a, b) => b.dateStr.localeCompare(a.dateStr))
    return rows.map(({ activity, dateStr }) => ({
      date: formatGroupDateLabel(dateStr),
      location: activity.location || '—',
      to: createActivityRoute(activity.id, dateStr, 'ended'),
    }))
  })

  const visibleUpcomingActivities = computed(() => (activeSegment.value === SEGMENT_ALL ? upcomingActivities.value.slice(0, UPCOMING_PREVIEW_COUNT) : upcomingActivities.value))
  const visibleEndedActivities = computed(() => (activeSegment.value === SEGMENT_ALL ? endedActivities.value.slice(0, ENDED_PREVIEW_COUNT) : endedActivities.value))

  function setSegment(segment) {
    activeSegment.value = segment
  }

  function isSegmentActive(segment) {
    return activeSegment.value === segment
  }

  function isSegmentVisible(segment) {
    return activeSegment.value === SEGMENT_ALL || activeSegment.value === segment
  }

  async function fetchLatestSpots() {
    if (!latestInfo.value) return

    const { activity, date } = latestInfo.value
    const registrations = await listRegistrationsForLatestSpots(activity.id, date)
    latestSpots.value = computeVacancy(registrations, date, activity.single_capacity)
  }

  async function fetchUpcomingSpots() {
    const uniqueActivityIds = [...new Set(activities.value.map(activity => activity.id))]
    const registrationsByActivityId = Object.fromEntries(
      await Promise.all(uniqueActivityIds.map(async id => [id, await listRegistrationsForActivitySpots(id)]))
    )

    const spots = {}
    for (const activity of activities.value) {
      const registrations = registrationsByActivityId[activity.id] || []
      for (const dateStr of getSortedDates(activity)) {
        spots[`${activity.id}_${dateStr}`] = computeVacancy(registrations, dateStr, activity.single_capacity)
      }
    }
    upcomingSpots.value = spots
  }

  async function fetchActivities() {
    activities.value = await listGroupActivities()
    isLoading.value = false
    await Promise.all([fetchLatestSpots(), fetchUpcomingSpots()])
  }

  onMounted(fetchActivities)

  return {
    activeSegment,
    segmentTabs: groupListSegmentTabs,
    isLoading,
    latestActivity,
    upcomingActivities,
    endedActivities,
    visibleUpcomingActivities,
    visibleEndedActivities,
    setSegment,
    isSegmentActive,
    isSegmentVisible,
  }
}
