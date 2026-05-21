<script setup>
import GroupEventRow from './GroupEventRow.vue'

defineProps({
  title: {
    type: String,
    required: true,
  },
  sectionId: {
    type: String,
    required: true,
  },
  items: {
    type: Array,
    required: true,
  },
  totalCount: {
    type: Number,
    required: true,
  },
  emptyText: {
    type: String,
    required: true,
  },
  ariaLabel: {
    type: String,
    required: true,
  },
  showMore: {
    type: Boolean,
    default: false,
  },
  rowFramed: {
    type: Boolean,
    default: false,
  },
  rowInset: {
    type: Boolean,
    default: false,
  },
  history: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['more'])
</script>

<template>
  <section :aria-labelledby="sectionId">
    <div class="section-heading" :class="{ 'history-title': history }">
      <h2 :id="sectionId" class="section-title">{{ title }}</h2>
      <button v-show="showMore" class="more-button" type="button" @click="$emit('more')">更多</button>
    </div>

    <div class="event-list" :class="{ 'history-list': history }" :aria-label="ariaLabel">
      <GroupEventRow
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        :date="item.date"
        :location="item.location"
        :badge="item.badge"
        :badge-variant="item.badgeVariant"
        :framed="rowFramed"
        :inset="rowInset"
      />
      <p v-if="totalCount === 0" class="empty-hint">{{ emptyText }}</p>
    </div>
  </section>
</template>

<style scoped>
.section-title {
  margin: 28px 0 12px;
  font-size: 18px;
  line-height: 1.36;
  letter-spacing: 0.36px;
  font-weight: 700;
  color: var(--text);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 28px 0 12px;
}

.section-heading .section-title {
  margin: 0;
}

.more-button {
  color: var(--primary-700);
  font-size: 14px;
  line-height: 1.4;
  font-weight: 400;
  white-space: nowrap;
}

.history-title {
  margin-top: 28px;
  margin-bottom: 12px;
}

.history-list {
  margin-top: 0;
}

.event-list {
  display: grid;
  gap: 0;
}

.empty-hint {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted-soft);
}
</style>
