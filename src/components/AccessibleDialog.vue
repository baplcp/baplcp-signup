<script setup>
import { nextTick, ref, watch } from 'vue'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  overlayClass: {
    type: [String, Array, Object],
    required: true,
  },
  contentClass: {
    type: [String, Array, Object],
    required: true,
  },
  zIndex: {
    type: Number,
    default: null,
  },
  closeOnOutside: {
    type: Boolean,
    default: true,
  },
  closeOnEscape: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['close'])
const previousFocus = ref(null)

watch(
  () => props.open,
  isOpen => {
    if (isOpen) previousFocus.value = document.activeElement
  },
  { flush: 'sync' }
)

function handleOpenChange(isOpen) {
  if (!isOpen) emit('close')
}

function preventOutsideClose(event) {
  if (!props.closeOnOutside) event.preventDefault()
}

function preventEscapeClose(event) {
  if (!props.closeOnEscape) event.preventDefault()
}

function restoreFocus(event) {
  event.preventDefault()
  nextTick(() => previousFocus.value?.focus?.({ preventScroll: true }))
}
</script>

<template>
  <DialogRoot :open="open" :unmount-on-hide="false" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogOverlay as-child>
        <div :class="[overlayClass, { 'is-open': open }]" :style="zIndex == null ? undefined : { zIndex }">
          <DialogContent as-child :aria-describedby="undefined" @pointer-down-outside="preventOutsideClose" @escape-key-down="preventEscapeClose" @close-auto-focus="restoreFocus">
            <section :class="contentClass">
              <DialogTitle class="accessible-dialog-title">{{ title }}</DialogTitle>
              <slot />
            </section>
          </DialogContent>
        </div>
      </DialogOverlay>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.accessible-dialog-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
