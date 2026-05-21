<script setup>
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  dates: {
    type: Array,
    default: () => [],
  },
  sessionCount: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['close'])

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [, month, day] = dateStr.split('-')
  const weekday = WEEKDAYS[new Date(dateStr + 'T00:00:00').getDay()]
  return `${Number(month)} 月 ${Number(day)} 日（${weekday}）`
}
</script>

<template>
  <div class="all-dates-overlay phone-container modal-frame" :class="{ 'is-open': open }" :aria-hidden="String(!open)" :inert="!open" @click.self="emit('close')">
    <section class="all-dates-sheet" role="dialog" aria-modal="true" aria-labelledby="all-dates-title">
      <div class="all-dates-header">
        <h2 id="all-dates-title" class="all-dates-title">所有場次日期</h2>
        <span class="all-dates-count">共 {{ sessionCount }} 次</span>
      </div>
      <div class="all-dates-list">
        <div v-for="(date, index) in dates" :key="date" class="all-dates-row">
          <span class="all-dates-index">{{ index + 1 }}</span>
          <span class="all-dates-label">{{ formatDate(date) }}</span>
        </div>
      </div>
      <div class="all-dates-actions">
        <button class="all-dates-close-btn" type="button" @click="emit('close')">關閉</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.all-dates-overlay {
  position: fixed;
  z-index: 10002;
  overflow: hidden;
  margin: auto;
  display: none;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.4);
}

.all-dates-overlay.is-open {
  display: flex;
}

.all-dates-sheet {
  width: 100%;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  border-radius: 18px 18px 0 0;
  background: #fff;
}

.all-dates-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #f0f1f7;
}

.all-dates-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.36;
  font-weight: 600;
  color: #101840;
}

.all-dates-count {
  font-size: 14px;
  color: #8f95b2;
  font-weight: 400;
}

.all-dates-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 20px;
  -webkit-overflow-scrolling: touch;
}

.all-dates-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid #f4f6fa;
}

.all-dates-row:last-child {
  border-bottom: none;
}

.all-dates-index {
  width: 24px;
  font-size: 13px;
  font-weight: 600;
  color: #c87416;
  text-align: center;
  flex: 0 0 auto;
}

.all-dates-label {
  font-size: 15px;
  color: #101840;
  line-height: 1.4;
}

.all-dates-actions {
  flex: 0 0 auto;
  padding: 14px 20px 20px;
  border-top: 1px solid #f0f1f7;
}

.all-dates-close-btn {
  width: 100%;
  min-height: 48px;
  border-radius: 10px;
  background: #f4f6fa;
  color: #474d66;
  font-size: 16px;
  font-weight: 500;
}
</style>
