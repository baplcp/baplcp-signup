<script setup>
import { computed, onMounted, ref } from 'vue'
import GroupActiveCard from '~/components/group-list/GroupActiveCard.vue'
import GroupEventRow from '~/components/group-list/GroupEventRow.vue'
import GroupSegmentTabs from '~/components/group-list/GroupSegmentTabs.vue'
import { supabase } from '~/utils/supabase'
import { useLiffStore } from '~/stores/liff'

const liffStore = useLiffStore()
const isOrganizer = computed(() => liffStore.role === 'organizer')

const isClearConfirmOpen = ref(false)
const isClearing = ref(false)

async function clearAllActivities() {
  isClearing.value = true
  try {
    await supabase.from('activities').delete().not('id', 'is', null)
    activity.value = null
  } finally {
    isClearing.value = false
    isClearConfirmOpen.value = false
  }
}

const activeSegment = ref('all')
const segmentTabs = [
  { label: '全部', value: 'all' },
  { label: '最新球局', value: 'latest' },
  { label: '即將到來', value: 'upcoming' },
  { label: '已結束', value: 'ended' },
]

const activity = ref(null)
const isLoading = ref(true)

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatDateLabel(dateStr) {
  const [, month, day] = dateStr.split('-')
  const weekday = WEEKDAYS[new Date(dateStr + 'T00:00:00').getDay()]
  return `${Number(month)}.${day} (${weekday})`
}

function formatTimeRange(startTime, endTime) {
  const fmt = t => (t || '').replace(/^0/, '').slice(0, 5)
  return `${fmt(startTime)}-${fmt(endTime)}`
}

function formatDateRow(dateStr, startTime, endTime) {
  return `${formatDateLabel(dateStr)}｜${formatTimeRange(startTime, endTime)}`
}

const today = new Date().toISOString().split('T')[0]

const latestActivity = computed(() => {
  if (!activity.value) return null
  const dates = (activity.value.dates || []).slice().sort()
  const latestDate = dates.find(d => d >= today) || null
  if (!latestDate) return null
  return {
    countLabel: '總名額',
    countValue: activity.value.single_capacity || '—',
    countAriaLabel: `總名額 ${activity.value.single_capacity || '—'} 人`,
    date: formatDateRow(latestDate, activity.value.start_time, activity.value.end_time),
    location: activity.value.location || '—',
    to: `/active-activity?id=${activity.value.id}&date=${latestDate}&type=latest`,
  }
})

const upcomingActivities = computed(() => {
  if (!activity.value) return []
  const dates = (activity.value.dates || []).slice().sort()
  const futureDates = dates.filter(d => d >= today).slice(1)
  return futureDates.map(dateStr => ({
    date: formatDateRow(dateStr, activity.value.start_time, activity.value.end_time),
    location: activity.value.location || '—',
    to: `/active-activity?id=${activity.value.id}&date=${dateStr}&type=upcoming`,
    badge: '未開放報名',
    badgeVariant: 'muted',
  }))
})

const endedActivities = computed(() => {
  if (!activity.value) return []
  const dates = (activity.value.dates || []).slice().sort().reverse()
  const pastDates = dates.filter(d => d < today)
  return pastDates.map(dateStr => ({
    date: formatDateLabel(dateStr),
    location: activity.value.location || '—',
    to: `/active-activity?id=${activity.value.id}&date=${dateStr}&type=ended`,
  }))
})

const visibleEndedActivities = computed(() => (activeSegment.value === 'all' ? endedActivities.value.slice(0, 3) : endedActivities.value))

onMounted(async () => {
  const { data } = await supabase
    .from('activities')
    .select('id, title, location, dates, start_time, end_time, single_capacity, pickup_fee_per_session, season_fee_per_session')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (data) activity.value = data
  isLoading.value = false
})

function setSegment(segment) {
  activeSegment.value = segment
}

function isSegmentActive(segment) {
  return activeSegment.value === segment
}

function isSegmentVisible(segment) {
  return activeSegment.value === 'all' || activeSegment.value === segment
}
</script>

<template>
  <main class="group-list-page">
    <div class="page-header">
      <h1 class="page-title">已發起的球局</h1>
      <button v-if="isOrganizer" type="button" class="clear-btn" @click="isClearConfirmOpen = true">清空資料</button>
    </div>

    <div
      class="confirm-overlay shared-dialog-overlay phone-container modal-frame"
      :class="{ 'is-open': isClearConfirmOpen }"
      :aria-hidden="String(!isClearConfirmOpen)"
      :inert="!isClearConfirmOpen"
    >
      <section class="confirm-dialog shared-dialog" role="dialog" aria-modal="true">
        <h2 class="shared-dialog-title">確定清空所有資料？</h2>
        <p class="shared-dialog-copy">此操作會刪除所有活動資料，無法復原。</p>
        <button class="confirm-delete-btn shared-dialog-button" type="button" :disabled="isClearing" @click="clearAllActivities">
          {{ isClearing ? '刪除中...' : '確認刪除' }}
        </button>
        <button class="confirm-cancel-btn shared-dialog-button" type="button" style="background:#f5f6fa;color:#474d66;" @click="isClearConfirmOpen = false">取消</button>
      </section>
    </div>

    <GroupSegmentTabs :items="segmentTabs" :active-segment="activeSegment" @change="setSegment" />

    <template v-if="!isLoading">
      <h2 v-show="isSegmentVisible('latest')" class="section-title" id="latest-section">最新球局</h2>
      <GroupActiveCard
        v-if="latestActivity && isSegmentVisible('latest')"
        v-show="isSegmentVisible('latest')"
        :count-label="latestActivity.countLabel"
        :count-value="latestActivity.countValue"
        :count-aria-label="latestActivity.countAriaLabel"
        :date="latestActivity.date"
        :location="latestActivity.location"
        :to="latestActivity.to"
      />
      <p v-else-if="isSegmentVisible('latest')" class="empty-hint">目前沒有即將到來的球局</p>

      <div v-show="isSegmentVisible('upcoming')" class="section-heading" id="upcoming-section">
        <h2 class="section-title">即將到來</h2>
        <button v-show="isSegmentActive('all')" class="more-button" type="button" @click="setSegment('upcoming')">更多</button>
      </div>
      <div v-show="isSegmentVisible('upcoming')" class="upcoming-list" aria-label="即將到來">
        <GroupEventRow
          v-for="act in upcomingActivities"
          :key="act.date"
          :to="act.to"
          :date="act.date"
          :location="act.location"
          :badge="act.badge"
          :badge-variant="act.badgeVariant"
          framed
        />
        <p v-if="upcomingActivities.length === 0" class="empty-hint">沒有其他即將到來的球局</p>
      </div>

      <div v-show="isSegmentVisible('ended')" class="section-heading history-title" id="ended-section">
        <h2 class="section-title">已結束</h2>
        <button v-show="isSegmentActive('all')" class="more-button" type="button" @click="setSegment('ended')">更多</button>
      </div>
      <div v-show="isSegmentVisible('ended')" class="history-list" aria-label="已結束">
        <GroupEventRow
          v-for="act in visibleEndedActivities"
          :key="act.date"
          :to="act.to"
          :date="act.date"
          :location="act.location"
          :badge="act.badge"
          :badge-variant="act.badgeVariant"
          inset
        />
        <p v-if="endedActivities.length === 0" class="empty-hint">沒有已結束的球局</p>
      </div>
    </template>

    <p v-if="isLoading" class="loading-hint">載入中…</p>
  </main>
</template>

<style scoped>
.group-list-page {
  background: var(--surface);
  height: 100%;
  padding: 31px 16px 0;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.36;
  letter-spacing: 0.48px;
  font-weight: 700;
  color: var(--text);
}

.clear-btn {
  font-size: 14px;
  line-height: 1.4;
  font-weight: 400;
  color: #d14343;
  white-space: nowrap;
}

.confirm-overlay {
  position: fixed;
  z-index: 9999;
  margin: auto;
}

.confirm-delete-btn {
  background: #d14343;
  width: 100%;
}

.confirm-delete-btn:disabled {
  background: #d8dae5;
  cursor: default;
}

.confirm-cancel-btn {
  width: 100%;
  margin-top: 4px;
}

.section-title {
  margin: 28px 0 12px;
  font-size: 18px;
  line-height: 1.36;
  letter-spacing: 0.36px;
  font-weight: 700;
  color: var(--text);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 28px 0 12px;
}

.section-heading .section-title {
  margin: 0;
}

.more-button {
  color: var(--primary-700);
  font-size: 14px;
  line-height: 1.4;
  font-weight: 400;
  white-space: nowrap;
}

.event-content {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 8px;
}

.event-date {
  margin: 0;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 500;
  color: var(--primary-700);
  white-space: nowrap;
}

.event-date .divider {
  color: var(--muted-soft);
}

.event-location {
  margin: 0;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 400;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-title {
  margin-top: 28px;
  margin-bottom: 12px;
}

.history-list {
  margin-top: 0;
}

.upcoming-list {
  display: grid;
  gap: 0;
}

.empty-hint,
.loading-hint {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted-soft);
}
</style>
