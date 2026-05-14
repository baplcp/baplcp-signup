<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '~/utils/supabase'
import { useLiffStore } from '~/stores/liff'

const router = useRouter()
const liffStore = useLiffStore()
const isOrganizer = computed(() => liffStore.role === 'organizer')

const activities = ref([])
const isLoading = ref(true)

onMounted(async () => {
  if (!isOrganizer.value) {
    router.replace('/')
    return
  }

  const { data } = await supabase
    .from('activities')
    .select('id, title, dates')
    .order('created_at', { ascending: false })

  if (data) activities.value = data
  isLoading.value = false
})
</script>

<template>
  <main class="manage-page">
    <div class="page-header">
      <h1 class="page-title">管理球局</h1>
    </div>

    <p v-if="isLoading" class="hint">載入中…</p>

    <template v-else>
      <p v-if="activities.length === 0" class="hint">尚無球局資料</p>

      <div v-else class="activity-list">
        <RouterLink
          v-for="act in activities"
          :key="act.id"
          :to="`/create-activity?id=${act.id}`"
          class="activity-row"
        >
          <span class="activity-title">{{ act.title || '（未命名球局）' }}</span>
          <span class="activity-count">{{ (act.dates || []).length }} 場</span>
          <svg class="row-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>
      </div>
    </template>
  </main>
</template>

<style scoped>
.manage-page {
  background: var(--surface);
  height: 100%;
  padding: 31px 16px 0;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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

.hint {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted-soft);
}

.activity-list {
  display: grid;
  gap: 0;
  border: 1px solid rgba(16, 24, 64, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.activity-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  text-decoration: none;
  color: var(--text);
  background: var(--surface);
  border-bottom: 1px solid rgba(16, 24, 64, 0.06);
}

.activity-row:last-child {
  border-bottom: none;
}

.activity-title {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-count {
  font-size: 14px;
  line-height: 1.4;
  color: var(--muted-soft);
  white-space: nowrap;
  flex: 0 0 auto;
}

.row-arrow {
  width: 20px;
  height: 20px;
  color: var(--muted-soft);
  flex: 0 0 auto;
}
</style>
