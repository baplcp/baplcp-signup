<script setup>
defineProps({
  countLabel: {
    type: String,
    required: true,
  },
  countValue: {
    type: [String, Number],
    required: true,
  },
  countAriaLabel: {
    type: String,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  to: {
    type: String,
    required: true,
  },
  actionLabel: {
    type: String,
    default: '前往',
  },
})
</script>

<template>
  <article class="active-card">
    <div class="active-count" :aria-label="countAriaLabel">
      <span class="active-count-label">{{ countLabel }}</span>
      <span class="active-count-value">{{ countValue }}</span>
    </div>
    <div class="event-content">
      <p class="event-date">{{ date }}</p>
      <p class="event-location">{{ location }}</p>
    </div>
    <RouterLink :to="to" class="go-button">{{ actionLabel }}</RouterLink>
  </article>
</template>

<style scoped>
.active-card {
  min-height: 92px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(239, 241, 254, 0.8);
}

.active-count {
  width: 64px;
  height: 68px;
  border-radius: 9px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.active-count-label {
  font-size: 12px;
  line-height: 1.25;
  font-weight: 500;
  color: var(--muted);
}

.active-count-value {
  margin-top: 1px;
  font-size: 32px;
  line-height: 1.25;
  font-weight: 500;
  color: var(--primary-700);
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

.event-location {
  margin: 0;
  font-size: 14px;
  line-height: 1.25;
  font-weight: 400;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.go-button {
  min-width: 64px;
  min-height: 44px;
  border-radius: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 17px;
  background: var(--primary-700);
  color: #fff;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 600;
  flex: 0 0 auto;
  text-decoration: none;
}
</style>
