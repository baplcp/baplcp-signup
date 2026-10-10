import { computed, onActivated, onMounted, reactive, ref, watch } from 'vue'
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

function createSegmentState() {
  return { sessions: [], hasMore: true, isLoadingMore: false, loadError: false }
}

export function useGroupListData(listSessions = listGroupActivitySessions) {
  const state = reactive({ status: 'loading', upcoming: createSegmentState(), ended: createSegmentState() })
  const isLoading = computed(() => state.status === 'loading')
  const loadError = computed(() => state.status === 'error')
  let requestId = 0
  let now = new Date()

  async function refreshActivities() {
    const currentRequestId = ++requestId
    const currentNow = new Date()
    now = currentNow
    state.status = 'loading'
    state.upcoming = createSegmentState()
    state.ended = createSegmentState()

    try {
      const [upcoming, ended] = await Promise.all([
        listSessions('upcoming', { limit: INITIAL_UPCOMING_LIMIT, cursor: null, now: currentNow }),
        listSessions('ended', { limit: PAGE_SIZE, cursor: null, now: currentNow }),
      ])
      if (currentRequestId !== requestId) return false
      state.upcoming.sessions = upcoming
      state.upcoming.hasMore = upcoming.length === INITIAL_UPCOMING_LIMIT
      state.ended.sessions = ended
      state.ended.hasMore = ended.length === PAGE_SIZE
      state.status = 'ready'
      return true
    } catch (error) {
      if (currentRequestId !== requestId) return false
      console.warn('Unable to load group activity sessions', error)
      state.status = 'error'
      return false
    }
  }

  async function loadMore(segment) {
    const segmentState = state[segment]
    if (state.status !== 'ready' || segmentState.isLoadingMore || !segmentState.hasMore) return

    const currentRequestId = requestId
    const currentNow = now
    const cursor = segmentState.sessions[segmentState.sessions.length - 1] || null
    segmentState.isLoadingMore = true
    segmentState.loadError = false
    try {
      const data = await listSessions(segment, { limit: PAGE_SIZE, cursor, now: currentNow })
      if (currentRequestId !== requestId) return
      segmentState.sessions = [...segmentState.sessions, ...data]
      segmentState.hasMore = data.length === PAGE_SIZE
    } catch (error) {
      if (currentRequestId !== requestId) return
      console.warn('Unable to load more group activity sessions', error)
      segmentState.loadError = true
    } finally {
      if (currentRequestId === requestId) segmentState.isLoadingMore = false
    }
  }

  return { state, isLoading, loadError, refreshActivities, loadMore }
}

export function useGroupListPage() {
  const route = useRoute()
  const router = useRouter()
  const groupListData = useGroupListData()
  const { state, isLoading, loadError } = groupListData
  const activeSegment = ref(SEGMENT_ALL)
  const upcomingSessions = computed(() => state.upcoming.sessions)
  const endedSessions = computed(() => state.ended.sessions)
  const isLoadingUpcomingMore = computed(() => state.upcoming.isLoadingMore)
  const isLoadingEndedMore = computed(() => state.ended.isLoadingMore)
  const hasMoreUpcoming = computed(() => state.upcoming.hasMore)
  const hasMoreEnded = computed(() => state.ended.hasMore)
  const upcomingLoadError = computed(() => state.upcoming.loadError)
  const endedLoadError = computed(() => state.ended.loadError)
  const hasExpandedUpcoming = ref(false)
  const hasExpandedEnded = ref(false)

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

  async function loadMoreUpcoming() {
    await groupListData.loadMore('upcoming')
  }

  async function loadMoreEnded() {
    await groupListData.loadMore('ended')
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

  async function refreshActivities() {
    hasExpandedUpcoming.value = false
    hasExpandedEnded.value = false
    if (await groupListData.refreshActivities()) expandSegment(activeSegment.value)
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
      if (state.status === 'ready') expandSegment(nextSegment)
    },
    { immediate: true }
  )

  onMounted(() => {
    consumeRefreshRequest()
    void refreshActivities()
  })

  onActivated(() => {
    if (consumeRefreshRequest()) void refreshActivities()
  })

  return {
    activeSegment,
    segmentTabs: groupListSegmentTabs,
    isLoading,
    loadError,
    latestActivity,
    upcomingActivities,
    endedActivities,
    visibleUpcomingActivities,
    visibleEndedActivities,
    hasMoreUpcoming,
    hasMoreEnded,
    isLoadingUpcomingMore,
    isLoadingEndedMore,
    upcomingLoadError,
    endedLoadError,
    setSegment,
    refreshActivities,
    loadMoreUpcoming,
    loadMoreEnded,
    isSegmentActive,
    isSegmentVisible,
  }
}
