<script setup>
import { computed, ref } from 'vue'
import GroupActiveCard from '~/components/group-list/GroupActiveCard.vue'
import GroupEventRow from '~/components/group-list/GroupEventRow.vue'
import GroupSegmentTabs from '~/components/group-list/GroupSegmentTabs.vue'

const activeSegment = ref('all')
const segmentTabs = [
  { label: '全部', value: 'all' },
  { label: '最新球局', value: 'latest' },
  { label: '即將到來', value: 'upcoming' },
  { label: '已結束', value: 'ended' },
]

const latestActivity = {
  countLabel: '臨打缺',
  countValue: 9,
  countAriaLabel: '臨打缺 9 人',
  date: '4.09 (日)｜8:00-11:00',
  location: '板橋柏吉倫排球場',
  to: '/active-activity',
}

const upcomingActivities = [
  { date: '4.16 (日)｜12:20-15:20', location: '板橋柏吉倫排球場', to: '/active-activity', badge: '未開放報名', badgeVariant: 'muted' },
  { date: '4.23 (日)｜12:20-15:20', location: '板橋柏吉倫排球場', to: '/active-activity', badge: '未開放報名', badgeVariant: 'muted' },
  { date: '4.30 (日)｜12:20-15:20', location: '板橋柏吉倫排球場', to: '/active-activity', badge: '未開放報名', badgeVariant: 'muted' },
]

const endedActivities = [
  { date: '4.02 (日)', location: '板橋柏吉倫排球場', to: '/ended-activity', badge: '已參加', badgeVariant: 'success' },
  { date: '3.28 (日)', location: '板橋柏吉倫排球場', to: '/ended-activity' },
  { date: '3.21 (日)', location: '板橋柏吉倫排球場', to: '/ended-activity', badge: '已請假', badgeVariant: 'muted' },
  { date: '3.14 (日)', location: '板橋柏吉倫排球場', to: '/ended-activity' },
  { date: '3.07(日)', location: '板橋柏吉倫排球場', to: '/ended-activity' },
]

const visibleEndedActivities = computed(() => (activeSegment.value === 'all' ? endedActivities.slice(0, 3) : endedActivities))

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
    <h1 class="page-title">已發起的球局</h1>

    <GroupSegmentTabs :items="segmentTabs" :active-segment="activeSegment" @change="setSegment" />

    <h2 v-show="isSegmentVisible('latest')" class="section-title" id="latest-section">最新球局</h2>
    <GroupActiveCard
      v-show="isSegmentVisible('latest')"
      :count-label="latestActivity.countLabel"
      :count-value="latestActivity.countValue"
      :count-aria-label="latestActivity.countAriaLabel"
      :date="latestActivity.date"
      :location="latestActivity.location"
      :to="latestActivity.to"
    />

    <div v-show="isSegmentVisible('upcoming')" class="section-heading" id="upcoming-section">
      <h2 class="section-title">即將到來</h2>
      <button v-show="isSegmentActive('all')" class="more-button" type="button" @click="setSegment('upcoming')">更多</button>
    </div>
    <div v-show="isSegmentVisible('upcoming')" class="upcoming-list" aria-label="即將到來">
      <GroupEventRow
        v-for="activity in upcomingActivities"
        :key="activity.date"
        :to="activity.to"
        :date="activity.date"
        :location="activity.location"
        :badge="activity.badge"
        :badge-variant="activity.badgeVariant"
        framed
      />
    </div>

    <div v-show="isSegmentVisible('ended')" class="section-heading history-title" id="ended-section">
      <h2 class="section-title">已結束</h2>
      <button v-show="isSegmentActive('all')" class="more-button" type="button" @click="setSegment('ended')">更多</button>
    </div>
    <div v-show="isSegmentVisible('ended')" class="history-list" aria-label="已結束">
      <GroupEventRow
        v-for="activity in visibleEndedActivities"
        :key="activity.date"
        :to="activity.to"
        :date="activity.date"
        :location="activity.location"
        :badge="activity.badge"
        :badge-variant="activity.badgeVariant"
        inset
      />
    </div>
  </main>
</template>

<style scoped>
.group-list-page {
  background: var(--surface);
  height: 100%;
  padding: 31px 16px 0;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.36;
  letter-spacing: 0.48px;
  font-weight: 700;
  color: var(--text);
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
</style>
