import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listGroupActivitySessions } from '~/services/registrationService'
import { formatTaiwanTime, getTaiwanWeekday } from '~/utils/taiwanDate'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const SEGMENT_ALL = 'all'
const PAGE_SIZE = 5
const INITIAL_UPCOMING_LIMIT = PAGE_SIZE + 1

export const groupListSegmentTabs = [
  { label: '全部', value: SEGMENT_ALL },
  { label: '最新球局', value: 'latest' },
  { label: '即將到來', value: 'upcoming' },
  { label: '已結束', value: 'ended' },
]

const GROUP_LIST_SEGMENTS = new Set(groupListSegmentTabs.map(tab => tab.value))

function getSegmentFromQuery(segment) {
  return typeof segment === 'string' && GROUP_LIST_SEGMENTS.has(segment) ? segment : SEGMENT_ALL
}

export function formatGroupDateLabel(dateStr) {
  const [, month, day] = dateStr.split('-')
  const weekday = WEEKDAYS[getTaiwanWeekday(dateStr)]
  return `${Number(month)}.${day} (${weekday})`
}

function formatTimeRange(startTime, endTime) {
  return `${formatTaiwanTime(startTime)}-${formatTaiwanTime(endTime)}`
}

function formatDateRow(dateStr, startTime, endTime) {
  return `${formatGroupDateLabel(dateStr)}｜${formatTimeRange(startTime, endTime)}`
}

function createActivityRoute(activityId, activityDateId, type) {
  return {
    name: 'activity',
    params: { id: activityId, activityDateId },
    query: { type },
  }
}

function computeVacancy(capacity, occupiedCount) {
  return Math.max(0, (capacity || 0) - (occupiedCount || 0))
}

function toUpcomingActivity(session) {
  const vacancy = computeVacancy(session.single_capacity, session.occupied_count)
  return {
    date: formatDateRow(session.activity_date, session.start_time, session.end_time),
    location: `缺 ${vacancy}・${session.location || '—'}`,
    to: createActivityRoute(session.season_id, session.activity_date_id, 'upcoming'),
    badge: '未開放報名',
    badgeVariant: 'muted',
  }
}

function toEndedActivity(session) {
  return {
    date: formatGroupDateLabel(session.activity_date),
    location: session.location || '—',
    to: createActivityRoute(session.season_id, session.activity_date_id, 'ended'),
  }
}

export function useGroupListPage() {
  const route = useRoute()
  const router = useRouter()
  const activeSegment = ref(SEGMENT_ALL)
  const upcomingSessions = ref([])
  const endedSessions = ref([])
  const isLoading = ref(true)
  const isLoadingUpcomingMore = ref(false)
  const isLoadingEndedMore = ref(false)
  const hasMoreUpcoming = ref(true)
  const hasMoreEnded = ref(true)
  const hasExpandedUpcoming = ref(false)
  const hasExpandedEnded = ref(false)
  let now = new Date()

  const latestSession = computed(() => upcomingSessions.value[0] || null)

  const latestActivity = computed(() => {
    if (!latestSession.value) return null
    const session = latestSession.value
    const vacancy = computeVacancy(session.single_capacity, session.occupied_count)

    return {
      countLabel: '臨打缺',
      countValue: vacancy,
      countAriaLabel: `臨打缺 ${vacancy} 人`,
      date: formatDateRow(session.activity_date, session.start_time, session.end_time),
      location: session.location || '—',
      to: createActivityRoute(session.season_id, session.activity_date_id, 'latest'),
    }
  })

  const upcomingActivities = computed(() => upcomingSessions.value.slice(1).map(toUpcomingActivity))
  const endedActivities = computed(() => endedSessions.value.map(toEndedActivity))
  const visibleUpcomingActivities = computed(() => (activeSegment.value === SEGMENT_ALL ? upcomingActivities.value.slice(0, PAGE_SIZE) : upcomingActivities.value))
  const visibleEndedActivities = computed(() => (activeSegment.value === SEGMENT_ALL ? endedActivities.value.slice(0, PAGE_SIZE) : endedActivities.value))

  async function fetchSessionPage(segment, limit) {
    const isUpcoming = segment === 'upcoming'
    const sessions = isUpcoming ? upcomingSessions : endedSessions
    const isLoadingMore = isUpcoming ? isLoadingUpcomingMore : isLoadingEndedMore
    const hasMore = isUpcoming ? hasMoreUpcoming : hasMoreEnded
    if (isLoadingMore.value || !hasMore.value) return

    isLoadingMore.value = true
    try {
      const cursor = sessions.value[sessions.value.length - 1] || null
      const data = await listGroupActivitySessions(segment, { limit, cursor, now })
      sessions.value = [...sessions.value, ...data]
      hasMore.value = data.length === limit
    } finally {
      isLoadingMore.value = false
    }
  }

  async function loadMoreUpcoming() {
    await fetchSessionPage('upcoming', PAGE_SIZE)
  }

  async function loadMoreEnded() {
    await fetchSessionPage('ended', PAGE_SIZE)
  }

  function expandSegment(segment) {
    activeSegment.value = segment
    if (segment === 'upcoming' && !hasExpandedUpcoming.value) {
      hasExpandedUpcoming.value = true
      void loadMoreUpcoming()
    }
    if (segment === 'ended' && !hasExpandedEnded.value) {
      hasExpandedEnded.value = true
      void loadMoreEnded()
    }
  }

  function setSegment(segment) {
    const nextSegment = getSegmentFromQuery(segment)
    if (route.query.segment === nextSegment) return

    router.replace({
      query: {
        ...route.query,
        segment: nextSegment,
      },
      state: {
        __inAppFrom: '/',
        __inAppFallbackFrom: '/',
        __skipInAppFromUpdate: true,
      },
    })
  }

  function isSegmentActive(segment) {
    return activeSegment.value === segment
  }

  function isSegmentVisible(segment) {
    return activeSegment.value === SEGMENT_ALL || activeSegment.value === segment
  }

  async function fetchActivities() {
    await Promise.all([fetchSessionPage('upcoming', INITIAL_UPCOMING_LIMIT), fetchSessionPage('ended', PAGE_SIZE)])
    isLoading.value = false
    expandSegment(activeSegment.value)
  }

  async function refreshActivities() {
    upcomingSessions.value = []
    endedSessions.value = []
    hasMoreUpcoming.value = true
    hasMoreEnded.value = true
    hasExpandedUpcoming.value = false
    hasExpandedEnded.value = false
    now = new Date()
    isLoading.value = true
    await fetchActivities()
  }

  function consumeRefreshRequest() {
    if (!window.history.state?.__refreshActivities) return false

    const { __refreshActivities, ...state } = window.history.state
    window.history.replaceState(state, '')
    return true
  }

  watch(
    () => route.query.segment,
    segment => {
      const nextSegment = getSegmentFromQuery(segment)
      activeSegment.value = nextSegment
      if (!isLoading.value) expandSegment(nextSegment)
    },
    { immediate: true }
  )

  onMounted(() => {
    consumeRefreshRequest()
    void fetchActivities()
  })

  onActivated(() => {
    if (consumeRefreshRequest()) void refreshActivities()
  })

  return {
    activeSegment,
    segmentTabs: groupListSegmentTabs,
    isLoading,
    latestActivity,
    upcomingActivities,
    endedActivities,
    visibleUpcomingActivities,
    visibleEndedActivities,
    hasMoreUpcoming,
    hasMoreEnded,
    isLoadingUpcomingMore,
    isLoadingEndedMore,
    setSegment,
    loadMoreUpcoming,
    loadMoreEnded,
    isSegmentActive,
    isSegmentVisible,
  }
}
