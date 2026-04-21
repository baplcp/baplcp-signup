<script setup>
defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  name: {
    type: String,
    required: true,
  },
  id: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    required: true,
  },
  options: {
    type: Array,
    required: true,
  },
  hasError: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'open', 'clear-error'])

function handleOpen() {
  emit('open')
}

function handleChange(event) {
  emit('update:modelValue', event.target.value)
  emit('clear-error')
}
</script>

<template>
  <span class="select-wrap" @click="handleOpen">
    <select
      :id="id || undefined"
      :value="modelValue"
      :name="name"
      data-time-select
      :class="{ 'is-placeholder': modelValue === '', 'is-error': hasError }"
      @change="handleChange"
    >
      <option value="">{{ placeholder }}</option>
      <option v-for="time in options" :key="`${name}-${time}`" :value="time">{{ time }}</option>
    </select>
  </span>
</template>

<style scoped>
.select-wrap {
  display: block;
  min-width: 0;
  position: relative;
}

.select-wrap select[data-time-select] {
  pointer-events: none;
}

select {
  font-size: 15px;
}

select.is-error {
  border-color: var(--danger-500);
  box-shadow: 0 0 0 3px rgba(209, 67, 67, 0.12);
}
</style>
