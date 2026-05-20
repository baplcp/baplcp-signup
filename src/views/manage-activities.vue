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
  await liffStore.initialize()
  if (!isOrganizer.value) {
    router.replace('/')
    return
  }

  const { data } = await supabase.from('activities').select('id, title, dates').order('created_at', { ascending: false })

  if (data) activities.value = data
  isLoading.value = false
})

// 左滑刪除
const SWIPE_OPEN_WIDTH = 72
const rowOffsets = ref({})
const activeDrag = ref({ index: -1, startX: 0, startY: 0, initOffset: 0, direction: null })

function getOffset(index) {
  return rowOffsets.value[index] ?? 0
}

function setOffset(index, x) {
  rowOffsets.value = { ...rowOffsets.value, [index]: x }
}

function rowStyle(index) {
  const x = getOffset(index)
  const isDragging = activeDrag.value.index === index && activeDrag.value.direction === 'h'
  return {
    transform: `translateX(${x}px)`,
    transition: isDragging ? 'none' : 'transform 0.25s ease',
  }
}

function onTouchStart(index, e) {
  const newOffsets = {}
  Object.keys(rowOffsets.value).forEach(i => {
    newOffsets[Number(i)] = 0
  })
  rowOffsets.value = newOffsets
  activeDrag.value = {
    index,
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    initOffset: getOffset(index),
    direction: null,
  }
}

function onTouchMove(index, e) {
  const drag = activeDrag.value
  if (drag.index !== index) return
  const dx = e.touches[0].clientX - drag.startX
  const dy = e.touches[0].clientY - drag.startY
  if (!drag.direction && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    activeDrag.value = { ...drag, direction: Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v' }
    return
  }
  if (activeDrag.value.direction !== 'h') return
  e.preventDefault()
  const newX = Math.min(0, Math.max(drag.initOffset + dx, -SWIPE_OPEN_WIDTH))
  setOffset(index, newX)
}

function onTouchEnd(index) {
  const drag = activeDrag.value
  if (drag.index !== index) return
  if (drag.direction === 'h') {
    const current = getOffset(index)
    const moved = current - drag.initOffset
    setOffset(index, moved < -(SWIPE_OPEN_WIDTH / 2) ? -SWIPE_OPEN_WIDTH : 0)
  }
  activeDrag.value = { index: -1, startX: 0, startY: 0, initOffset: 0, direction: null }
}

function handleRowClick(act, index) {
  if (getOffset(index) !== 0) {
    setOffset(index, 0)
    return
  }
  router.push(`/create-activity?id=${act.id}`)
}

// 刪除確認
const deleteTarget = ref(null)
const isDeleting = ref(false)

function openDeleteConfirm(act, index) {
  setOffset(index, 0)
  deleteTarget.value = { act, index }
}

function cancelDelete() {
  deleteTarget.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    await invokeActivityAdmin({ action: 'delete', id: deleteTarget.value.act.id })
    activities.value = activities.value.filter(a => a.id !== deleteTarget.value.act.id)
    rowOffsets.value = {}
  } finally {
    isDeleting.value = false
    deleteTarget.value = null
  }
}

async function invokeActivityAdmin(body) {
  const lineAccessToken = await liffStore.getLineAccessToken()
  if (!lineAccessToken) throw new Error('missing_line_access_token')

  const { error } = await supabase.functions.invoke('activity-admin', {
    body,
    headers: { 'x-line-access-token': lineAccessToken },
  })
  if (error) throw error
}
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
        <div v-for="(act, index) in activities" :key="act.id" class="swipe-row-container">
          <button class="swipe-delete-btn" type="button" @click="openDeleteConfirm(act, index)">刪除</button>
          <div
            class="activity-row"
            :style="rowStyle(index)"
            @touchstart="onTouchStart(index, $event)"
            @touchmove="onTouchMove(index, $event)"
            @touchend="onTouchEnd(index)"
            @click="handleRowClick(act, index)"
          >
            <span class="activity-title">{{ act.title || '（未命名球局）' }}</span>
            <span class="activity-count">{{ (act.dates || []).length }} 場</span>
            <svg class="row-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </template>

    <div class="fab-container">
      <button class="fab-create-btn" type="button" @click="router.push('/create-activity')">
        <svg class="fab-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        建立新球局
      </button>
    </div>

    <div
      class="confirm-overlay shared-dialog-overlay phone-container modal-frame"
      :class="{ 'is-open': deleteTarget !== null }"
      :aria-hidden="String(deleteTarget === null)"
      :inert="deleteTarget === null"
    >
      <section class="confirm-dialog shared-dialog" role="dialog" aria-modal="true">
        <h2 class="shared-dialog-title">確定刪除此球局？</h2>
        <p class="shared-dialog-copy">「{{ deleteTarget?.act.title || '（未命名球局）' }}」將被永久刪除，無法復原。</p>
        <button class="confirm-delete-btn shared-dialog-button" type="button" :disabled="isDeleting" @click="confirmDelete">
          {{ isDeleting ? '刪除中...' : '確認刪除' }}
        </button>
        <button class="confirm-cancel-btn shared-dialog-button" type="button" @click="cancelDelete">取消</button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.manage-page {
  background: var(--surface);
  height: 100%;
  padding: 31px 16px 96px;
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

.swipe-row-container {
  position: relative;
  overflow: hidden;
}

.swipe-row-container:not(:last-child) .activity-row {
  border-bottom: 1px solid rgba(16, 24, 64, 0.06);
}

.swipe-delete-btn {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 72px;
  background: #d14343;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  z-index: 1;
}

.activity-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  color: var(--text);
  background: var(--surface);
  position: relative;
  z-index: 2;
  cursor: pointer;
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
  background: #f5f6fa;
  color: #474d66;
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

.fab-container {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  padding: 12px 16px 28px;
  background: var(--surface);
  border-top: 1px solid rgba(16, 24, 64, 0.08);
  z-index: 100;
}

.fab-create-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 20px;
  background: var(--primary, #3366ff);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
}

.fab-icon {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}
</style>
