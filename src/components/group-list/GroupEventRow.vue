<script setup>
defineProps({
  to: {
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
  badge: {
    type: String,
    default: '',
  },
  badgeVariant: {
    type: String,
    default: 'muted',
  },
  framed: {
    type: Boolean,
    default: false,
  },
  inset: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <RouterLink
    class="event-row"
    :class="{
      'is-framed': framed,
      'is-inset': inset,
    }"
    :to="to"
  >
    <div class="event-content">
      <p class="event-date">{{ date }}</p>
      <p class="event-location">{{ location }}</p>
    </div>
    <span v-if="badge" class="badge" :class="`badge-${badgeVariant}`">{{ badge }}</span>
    <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </RouterLink>
</template>

<style scoped>
.event-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
  text-decoration: none;
}

.event-row.is-framed {
  padding: 16px 0 16px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-bottom: 12px;
}

.event-row.is-inset {
  padding-left: 12px;
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
  color: var(--text);
  white-space: nowrap;
}

.event-location {
  margin: 0;
  font-size: 14px;
  line-height: 1.25;
  font-weight: 400;
  color: var(--muted-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 400;
  white-space: nowrap;
  flex: 0 0 auto;
}

.badge-success {
  background: var(--secondary-100);
  color: var(--secondary-600);
}

.badge-muted {
  background: var(--line);
  color: var(--muted-soft);
}

.chevron {
  width: 24px;
  height: 24px;
  color: #696f8c;
  flex: 0 0 auto;
}
</style>
