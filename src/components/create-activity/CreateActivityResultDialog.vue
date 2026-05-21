<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
  },
  copy: {
    type: String,
    required: true,
  },
  buttonText: {
    type: String,
    default: '確認',
  },
})

const emit = defineEmits(['close'])
const dialogButton = ref(null)

watch(
  () => props.open,
  open => {
    if (open) nextTick(() => dialogButton.value?.focus({ preventScroll: true }))
  }
)
</script>

<template>
  <div
    class="success-dialog-overlay shared-dialog-overlay phone-container modal-frame"
    :class="{ 'is-open': open }"
    :aria-hidden="String(!open)"
    :inert="!open"
    @click.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <section class="success-dialog shared-dialog" role="dialog" aria-modal="true" aria-labelledby="create-dialog-title">
      <h2 id="create-dialog-title" class="success-dialog-title shared-dialog-title">{{ title }}</h2>
      <p class="success-dialog-copy shared-dialog-copy">{{ copy }}</p>
      <button ref="dialogButton" class="success-dialog-button shared-dialog-button" type="button" @click="emit('close')">{{ buttonText }}</button>
    </section>
  </div>
</template>

<style scoped>
.success-dialog-overlay {
  position: fixed;
}
</style>
