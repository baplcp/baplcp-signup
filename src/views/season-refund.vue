<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listSeasonActivitiesForRefund } from '~/services/activityService'

const router = useRouter()
const activities = ref([])
const isLoading = ref(true)

function formatDateRange(dates) {
  if (!dates || dates.length === 0) return '—'
  const sorted = dates.slice().sort()
  const [, m1] = sorted[0].split('-')
  const [, m2] = sorted[sorted.length - 1].split('-')
  const sessions = sorted.length
  if (m1 === m2) return `${Number(m1)} 月，共 ${sessions} 場`
  return `${Number(m1)} ~ ${Number(m2)} 月，共 ${sessions} 場`
}

function goToDetail(actId) {
  router.push({ name: 'season-refund-detail', params: { id: actId } })
}

onMounted(async () => {
  activities.value = await listSeasonActivitiesForRefund()
  isLoading.value = false
})
</script>

<template>
  <main class="season-refund-page">
    <div class="page-header">
      <h1 class="page-title">季打退費</h1>
      <p class="page-sub">選擇球季查看成員請假與應退金額</p>
    </div>

    <template v-if="!isLoading">
      <div v-if="activities.length > 0" class="activity-list">
        <button
          v-for="act in activities"
          :key="act.id"
          class="season-row"
          type="button"
          @click="goToDetail(act.id)"
        >
          <div class="season-info">
            <div class="season-name">{{ act.title || '季打' }}</div>
            <div class="season-sub">{{ formatDateRange(act.dates) }}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <p v-else class="empty-hint">目前沒有季打活動</p>
    </template>

    <p v-if="isLoading" class="loading-hint">載入中…</p>
  </main>
</template>

<style scoped>
.season-refund-page {
  background: var(--surface);
  height: 100%;
  padding: 31px 16px 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  margin: 0 0 4px;
  font-size: 24px;
  line-height: 1.36;
  letter-spacing: 0.48px;
  font-weight: 700;
  color: var(--text);
}

.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--muted-soft);
}

.activity-list {
  display: grid;
  gap: 0;
}

.season-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-subtle, rgba(16, 24, 64, 0.06));
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  cursor: pointer;
  text-align: left;
  color: var(--muted-soft, #8f95b2);
}

.season-row:last-child {
  border-bottom: none;
}

.season-info {
  flex: 1;
  min-width: 0;
}

.season-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 3px;
}

.season-sub {
  font-size: 13px;
  color: var(--muted-soft, #8f95b2);
}

.empty-hint,
.loading-hint {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted-soft);
}
</style>
