<script setup>
defineProps({
  kind: {
    type: String,
    required: true,
    validator: value => ['loading', 'empty', 'error'].includes(value),
  },
  message: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['retry'])
</script>

<template>
  <div v-if="kind === 'error'" class="page-feedback is-error" role="alert">
    <p>{{ message }}</p>
    <button type="button" @click="emit('retry')">重新載入</button>
  </div>
  <p v-else class="page-feedback" :role="kind === 'loading' ? 'status' : undefined">{{ message }}</p>
</template>

<style scoped>
.page-feedback {
  margin: 12px 0 0;
  color: var(--muted-soft);
  font-size: 14px;
  line-height: 1.5;
}

.page-feedback.is-error {
  display: grid;
  justify-items: start;
  gap: 12px;
}

.page-feedback.is-error button {
  min-height: 40px;
  padding: 8px 16px;
  border-radius: 10px;
  background: var(--primary-700);
  color: var(--neutral-0);
  font-size: 14px;
  font-weight: 500;
}
</style>
