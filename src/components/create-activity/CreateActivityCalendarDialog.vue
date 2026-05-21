<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
  },
  days: {
    type: Array,
    required: true,
  },
  selectedValues: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close', 'change-month', 'select-date'])
</script>

<template>
  <div class="calendar-overlay phone-container modal-frame" :class="{ 'is-open': open }" :aria-hidden="String(!open)" @click.self="emit('close')">
    <section class="calendar-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
      <div class="calendar-header">
        <button class="calendar-nav" type="button" aria-label="上一個月" @click="emit('change-month', -1)">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <h2 id="calendar-title" class="calendar-title">{{ title }}</h2>
        <button class="calendar-nav" type="button" aria-label="下一個月" @click="emit('change-month', 1)">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div class="calendar-weekdays" aria-hidden="true"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
      <div class="calendar-grid">
        <button
          v-for="day in days"
          :key="day.value"
          class="calendar-day"
          :class="{ 'is-muted': day.isMuted, 'is-selected': selectedValues.includes(day.value) }"
          type="button"
          @click="emit('select-date', day.value)"
        >
          {{ day.label }}
        </button>
      </div>
      <div class="calendar-actions">
        <button class="calendar-action is-muted" type="button" @click="emit('close')">取消</button>
        <button class="calendar-action is-primary" type="button" @click="emit('close')">完成</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.calendar-overlay {
  position: fixed;
  z-index: 20;
  overflow: hidden;
  margin: auto;
  display: none;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.32);
}

.calendar-overlay.is-open {
  display: flex;
}

.calendar-sheet {
  width: 100%;
  padding: 16px;
  border-radius: 18px 18px 0 0;
  background: #fff;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.calendar-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.36;
  font-weight: 600;
}

.calendar-nav {
  min-width: 40px;
  min-height: 36px;
  display: grid;
  place-items: center;
  color: var(--primary-600);
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-weekdays {
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

.calendar-day {
  min-height: 36px;
  border-radius: 9px;
  color: var(--text);
  font-size: 14px;
}

.calendar-day.is-muted {
  color: #bdc1d1;
}

.calendar-day.is-selected {
  background: var(--primary-600);
  color: #fff;
}

.calendar-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.calendar-action {
  min-height: 44px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
}

.calendar-action.is-muted {
  background: #f4f6fa;
  color: var(--muted);
}

.calendar-action.is-primary {
  background: var(--primary-600);
  color: #fff;
}
</style>
