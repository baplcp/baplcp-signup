import { computed, onMounted, ref } from 'vue'
import { supabase } from '~/utils/supabase'

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

export function useGroupListPage() {
  const activeSegment = ref(SEGMENT_ALL)
  const activities = ref([])
  const isLoading = ref(true)
  const latestSpots = ref(null)
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
    return rows.map(({ activity, dateStr }) => ({
      date: formatDateRow(dateStr, activity.start_time, activity.end_time),
      location: activity.location || '—',
      to: createActivityRoute(activity.id, dateStr, 'upcoming'),
      badge: '未開放報名',
      badgeVariant: 'muted',
    }))
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
    const { data: registrations } = await supabase
      .from('registrations')
      .select('self_count, guest_count')
      .eq('activity_id', activity.id)
      .or(`activity_date.eq.${date},activity_date.is.null`)
      .eq('status', 'active')

    if (!registrations) return

    const totalPeople = registrations.reduce((sum, registration) => sum + (registration.self_count || 0) + (registration.guest_count || 0), 0)
    latestSpots.value = Math.max(0, (activity.single_capacity || 0) - totalPeople)
  }

  async function fetchActivities() {
    const { data } = await supabase
      .from('activities')
      .select('id, title, location, dates, start_time, end_time, single_capacity, pickup_fee_per_session, season_fee_per_session')
      .order('created_at', { ascending: false })

    activities.value = data || []
    isLoading.value = false
    await fetchLatestSpots()
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
