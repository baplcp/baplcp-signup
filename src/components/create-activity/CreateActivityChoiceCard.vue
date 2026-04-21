<script setup>
defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  condensed: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
  },
  copy: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['select'])

function handleSelect() {
  emit('select')
}

function handleKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  handleSelect()
}
</script>

<template>
  <div
    class="choice-card"
    :class="{ 'is-active': active, 'is-condensed': condensed }"
    role="button"
    tabindex="0"
    :aria-pressed="String(active)"
    @click="handleSelect"
    @keydown="handleKeydown"
  >
    <span class="radio-mark" aria-hidden="true"></span>
    <span class="choice-content">
      <span class="choice-title">{{ title }}</span>
      <span v-if="copy" class="choice-copy">{{ copy }}</span>
      <slot></slot>
    </span>
  </div>
</template>

<style scoped>
.choice-card {
  min-height: 80px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  padding: 14px;
}

.choice-card.is-condensed {
  align-items: center;
  min-height: 66px;
}

.choice-card.is-active {
  border-color: var(--primary-600);
}

.radio-mark {
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--line-soft);
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  margin-top: 2px;
}

.choice-card.is-active .radio-mark {
  border-color: var(--primary-600);
}

.choice-card.is-active .radio-mark::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary-600);
}

.choice-content {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.choice-title {
  color: var(--text);
  font-size: 15px;
  line-height: 1.35;
  font-weight: 600;
}

.choice-copy {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.3;
  font-weight: 400;
}

.choice-card.is-condensed :slotted(.choice-rule) {
  display: none;
}
</style>
