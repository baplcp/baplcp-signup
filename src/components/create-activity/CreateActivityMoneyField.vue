<script setup>
defineProps({
  modelValue: {
    type: [Number, String],
    default: '',
  },
  label: {
    type: String,
    required: true,
  },
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  hasError: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'clear-error'])

function handleInput(event) {
  emit('update:modelValue', event.target.value)
  emit('clear-error')
}
</script>

<template>
  <label class="fee-mini-field">
    <span class="mini-label">{{ label }}</span>
    <span class="money-input" :class="{ 'is-error': hasError }">
      <span>$</span>
      <input :id="id" :value="modelValue" :name="name" type="number" min="0" inputmode="numeric" @input="handleInput" />
    </span>
  </label>
</template>

<style scoped>
.fee-mini-field {
  display: grid;
  gap: 8px;
}

.mini-label {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.2;
  font-weight: 400;
}

.money-input {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 41px;
  border: 1px solid var(--neutral-300);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  color: var(--text);
  font-size: 15px;
  line-height: 1.25;
}

.money-input input {
  min-height: 0;
  border: 0;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  font-size: 15px;
}

.money-input.is-error {
  border-color: var(--danger-500);
  box-shadow: 0 0 0 3px rgba(209, 67, 67, 0.12);
}
</style>
