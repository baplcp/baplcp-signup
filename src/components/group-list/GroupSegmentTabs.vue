<script setup>
defineProps({
  items: {
    type: Array,
    required: true,
  },
  activeSegment: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['change'])

function handleClick(segment) {
  emit('change', segment)
}
</script>

<template>
  <nav class="segment-tabs" aria-label="球局分類">
    <button
      v-for="item in items"
      :key="item.value"
      class="segment-tab"
      :class="{ 'is-active': activeSegment === item.value }"
      type="button"
      @click="handleClick(item.value)"
    >
      {{ item.label }}
    </button>
  </nav>
</template>

<style scoped>
.segment-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: end;
  margin: 20px 0 0;
  border-bottom: 1px solid rgba(237, 239, 245, 0.9);
}

.segment-tab {
  position: relative;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px 11px;
  color: var(--muted-soft);
  font-size: 14px;
  line-height: 1.4;
  font-weight: 400;
  white-space: nowrap;
}

.segment-tab.is-active {
  color: var(--text);
  font-weight: 600;
}

.segment-tab.is-active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  border-radius: 999px;
  background: var(--primary-700);
}
</style>
