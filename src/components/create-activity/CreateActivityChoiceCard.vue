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
</script>

<template>
  <div class="choice-card" :class="{ 'is-active': active, 'is-condensed': condensed, 'has-extra': !!$slots.default }">
    <button class="choice-select" type="button" :aria-pressed="active" @click="emit('select')">
      <span class="radio-mark" aria-hidden="true"></span>
      <span class="choice-content">
        <span class="choice-title">{{ title }}</span>
        <span v-if="copy" class="choice-copy">{{ copy }}</span>
      </span>
    </button>
    <div v-if="$slots.default" v-show="!condensed" class="choice-extra"><slot /></div>
  </div>
</template>

<style scoped>
.choice-card {
  min-height: 80px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
}

.choice-card.is-condensed {
  min-height: 66px;
}

.choice-card.is-active {
  border-color: var(--primary-600);
}

.choice-select {
  width: 100%;
  min-height: 78px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  text-align: left;
}

.choice-card.is-condensed .choice-select {
  min-height: 64px;
  align-items: center;
}

.choice-card.has-extra:not(.is-condensed) .choice-select {
  min-height: 0;
  padding-bottom: 0;
}

.choice-extra {
  padding: 0 14px 14px 46px;
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
</style>
