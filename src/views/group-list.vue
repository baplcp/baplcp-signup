<script setup>
import GroupActiveCard from '~/components/group-list/GroupActiveCard.vue'
import GroupEventSection from '~/components/group-list/GroupEventSection.vue'
import GroupSegmentTabs from '~/components/group-list/GroupSegmentTabs.vue'
import { useGroupListPage } from '~/composables/useGroupListPage'

const groupListPage = useGroupListPage()
const { activeSegment, segmentTabs, isLoading, latestActivity } = groupListPage
const { upcomingActivities, endedActivities, visibleUpcomingActivities, visibleEndedActivities } = groupListPage
const { hasMoreUpcoming, hasMoreEnded, isLoadingUpcomingMore, isLoadingEndedMore } = groupListPage
const { setSegment, isSegmentActive, isSegmentVisible, loadMoreUpcoming, loadMoreEnded } = groupListPage
</script>

<template>
  <main class="group-list-page">
    <div class="page-header">
      <h1 class="page-title">已發起的球局</h1>
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

      <GroupEventSection
        v-show="isSegmentVisible('upcoming')"
        title="即將到來"
        section-id="upcoming-section"
        :items="visibleUpcomingActivities"
        :total-count="visibleUpcomingActivities.length"
        empty-text="沒有其他即將到來的球局"
        aria-label="即將到來"
        :show-more="isSegmentActive('all')"
        :has-more="isSegmentActive('upcoming') && hasMoreUpcoming"
        :is-loading-more="isLoadingUpcomingMore"
        row-framed
        @more="setSegment('upcoming')"
        @load-more="loadMoreUpcoming"
      />

      <GroupEventSection
        v-show="isSegmentVisible('ended')"
        title="已結束"
        section-id="ended-section"
        :items="visibleEndedActivities"
        :total-count="visibleEndedActivities.length"
        empty-text="沒有已結束的球局"
        aria-label="已結束"
        :show-more="isSegmentActive('all')"
        :has-more="isSegmentActive('ended') && hasMoreEnded"
        :is-loading-more="isLoadingEndedMore"
        row-inset
        history
        @more="setSegment('ended')"
        @load-more="loadMoreEnded"
      />
    </template>

    <p v-if="isLoading" class="loading-hint">載入中…</p>
  </main>
</template>

<style scoped>
.group-list-page {
  background: var(--surface);
  min-height: 100%;
  padding: 31px 16px calc(20px + env(safe-area-inset-bottom));
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

.section-title {
  margin: 28px 0 12px;
  font-size: 18px;
  line-height: 1.36;
  letter-spacing: 0.36px;
  font-weight: 700;
  color: var(--text);
}

.empty-hint,
.loading-hint {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted-soft);
}
</style>
