<script setup>
import { onMounted, ref } from 'vue'
import GroupEventRow from '~/components/group-list/GroupEventRow.vue'
import { listSeasonActivities } from '~/services/activityService'

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

function getRegistrationBadge(act) {
  const now = new Date()

  if (act.season_open_date) {
    const openTime = act.season_open_time || '00:00'
    const openDt = new Date(`${act.season_open_date}T${openTime}:00`)
    if (now < openDt) return { label: '未開放', variant: 'muted' }
  }

  if (act.season_deadline_type === 'custom' && act.season_close_date) {
    const closeTime = act.season_close_time || '23:59'
    const closeDt = new Date(`${act.season_close_date}T${closeTime}:00`)
    if (now > closeDt) return { label: '已截止', variant: 'ended' }
  }

  return { label: '報名中', variant: 'success' }
}

onMounted(async () => {
  activities.value = await listSeasonActivities()
  isLoading.value = false
})
</script>

<template>
  <main class="season-list-page">
    <div class="page-header">
      <h1 class="page-title">季打報名</h1>
    </div>

    <template v-if="!isLoading">
      <div v-if="activities.length > 0" class="activity-list">
        <GroupEventRow
          v-for="act in activities"
          :key="act.id"
          :to="`/active-activity?type=season&id=${act.id}`"
          :date="act.title || '季打報名'"
          :location="formatDateRange(act.dates)"
          :badge="getRegistrationBadge(act).label"
          :badge-variant="getRegistrationBadge(act).variant"
          framed
        />
      </div>
      <p v-else class="empty-hint">目前沒有開放中的季打報名</p>
    </template>

    <p v-if="isLoading" class="loading-hint">載入中…</p>
  </main>
</template>

<style scoped>
.season-list-page {
  background: var(--surface);
  height: 100%;
  padding: 31px 16px 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.36;
  letter-spacing: 0.48px;
  font-weight: 700;
  color: var(--text);
}

.activity-list {
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
