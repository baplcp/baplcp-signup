<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMyRecords } from '~/composables/useMyRecords'

const INITIAL_ATTENDANCE_COUNT = 5

const { attendanceRecords, refundGroups, hasSeasonRegistration, isLoginRequired, isLoading, loadError, loadMyRecords } = useMyRecords()

const expandedQuarterKeys = ref(new Set())
const showAllAttendance = ref(false)

const visibleAttendanceRecords = computed(() => (showAllAttendance.value ? attendanceRecords.value : attendanceRecords.value.slice(0, INITIAL_ATTENDANCE_COUNT)))
const hasMoreAttendance = computed(() => !showAllAttendance.value && attendanceRecords.value.length > INITIAL_ATTENDANCE_COUNT)
const hasAnyLeave = computed(() => refundGroups.value.some(group => group.quarters.length > 0))
const showGroupTitle = computed(() => refundGroups.value.filter(group => group.quarters.length > 0).length > 1)

function toggleQuarter(key) {
  const keys = new Set(expandedQuarterKeys.value)
  if (keys.has(key)) keys.delete(key)
  else keys.add(key)
  expandedQuarterKeys.value = keys
}

function quarterPanelId(key) {
  return `refund-dates-${key.replace(/[^a-zA-Z0-9-]/g, '-')}`
}

onMounted(loadMyRecords)
</script>

<template>
  <main class="my-records-page">
    <div class="page-header">
      <h1 class="page-title">我的紀錄</h1>
    </div>

    <p v-if="isLoading" class="loading-hint">載入中…</p>
    <div v-else-if="loadError" class="load-error" role="alert">
      <p class="loading-hint">無法載入紀錄，請確認網路後再試一次。</p>
      <button class="retry-button" type="button" @click="loadMyRecords">重新載入</button>
    </div>
    <p v-else-if="isLoginRequired" class="empty-hint">請先登入 LINE 才能查看紀錄</p>

    <template v-else>
      <section v-if="hasSeasonRegistration" class="record-section" aria-labelledby="refund-title">
        <h2 id="refund-title" class="section-title">請假退費</h2>
        <template v-if="hasAnyLeave">
          <template v-for="group in refundGroups" :key="group.registrationId">
            <div v-if="group.quarters.length > 0" class="refund-group">
              <p v-if="showGroupTitle" class="refund-group-title">{{ group.title }}</p>
              <div class="refund-card">
                <div v-for="quarter in group.quarters" :key="quarter.key" class="refund-quarter" :class="{ 'is-open': expandedQuarterKeys.has(quarter.key) }">
                  <button
                    class="refund-quarter-header"
                    type="button"
                    :aria-expanded="expandedQuarterKeys.has(quarter.key)"
                    :aria-controls="quarterPanelId(quarter.key)"
                    @click="toggleQuarter(quarter.key)"
                  >
                    <span class="refund-quarter-label">
                      {{ quarter.label }}<span class="refund-quarter-count"> · {{ quarter.leaveCount }} 次</span>
                    </span>
                    <span class="refund-quarter-amount">${{ quarter.refundAmount.toLocaleString() }}</span>
                    <svg class="refund-quarter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <p v-show="expandedQuarterKeys.has(quarter.key)" :id="quarterPanelId(quarter.key)" class="refund-quarter-dates">請假：{{ quarter.formattedDates.join('、') }}</p>
                </div>
              </div>
            </div>
          </template>
        </template>
        <p v-else class="empty-hint">目前沒有請假紀錄</p>
      </section>

      <section class="record-section" aria-labelledby="attendance-title">
        <h2 id="attendance-title" class="section-title">出席紀錄</h2>
        <ul v-if="attendanceRecords.length > 0" class="attendance-list">
          <li v-for="record in visibleAttendanceRecords" :key="record.key">
            <RouterLink class="attendance-row" :to="record.to">
              <span class="attendance-date">{{ record.label }}</span>
              <span class="attendance-meta">
                <span v-if="record.unpaid" class="attendance-unpaid">尚未繳費</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="empty-hint">目前還沒有出席紀錄</p>
        <button v-if="hasMoreAttendance" class="show-more-button" type="button" @click="showAllAttendance = true">
          查看全部
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </section>
    </template>
  </main>
</template>

<style scoped>
.my-records-page {
  background: var(--surface);
  min-height: 100%;
  padding: 31px 16px 40px;
}

.page-header {
  margin-bottom: 8px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.36;
  letter-spacing: 0.48px;
  font-weight: 700;
  color: var(--text);
}

.record-section {
  margin-top: 20px;
}

.section-title {
  margin: 0 0 8px;
  font-size: 17px;
  line-height: 1.4;
  font-weight: 600;
  color: var(--text);
}

.refund-group + .refund-group {
  margin-top: 12px;
}

.refund-group-title {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--muted);
}

.refund-card {
  --refund-card-line: color-mix(in srgb, var(--primary-300) 30%, transparent);
  background: var(--primary-100);
  border: 1px solid var(--refund-card-line);
  border-radius: 14px;
  padding: 0 14px;
}

.refund-quarter + .refund-quarter {
  border-top: 1px solid var(--refund-card-line);
}

.refund-quarter-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 12px 0;
  border: 0;
  background: transparent;
  font: inherit;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.refund-quarter-label {
  flex: 1;
  font-size: 15px;
}

.refund-quarter-count {
  font-size: 13px;
  color: var(--muted);
}

.refund-quarter-amount {
  font-size: 15px;
  font-weight: 600;
  color: var(--primary-700);
}

.refund-quarter-chevron {
  flex-shrink: 0;
  color: var(--primary-400);
  transition: transform 0.2s ease;
}

.refund-quarter.is-open .refund-quarter-chevron {
  transform: rotate(90deg);
}

.refund-quarter-dates {
  margin: -4px 0 0;
  padding: 0 0 12px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--muted-soft);
  word-break: break-all;
}

.attendance-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.attendance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 12px 0;
  border-bottom: 1px solid var(--neutral-200);
  color: var(--text);
  text-decoration: none;
}

.attendance-date {
  font-size: 15px;
}

.attendance-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-soft);
}

.attendance-unpaid {
  font-size: 13px;
  color: var(--danger-500);
}

.show-more-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-height: 44px;
  margin-top: 4px;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 13px;
  color: var(--primary-700);
  cursor: pointer;
}

.empty-hint,
.loading-hint {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted-soft);
}

.retry-button {
  margin-top: 12px;
  padding: 8px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}
</style>
