<script setup>
import AccessibleDialog from '~/components/AccessibleDialog.vue'

defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  dialogId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  copy: {
    type: String,
    required: true,
  },
  cancelAriaLabel: {
    type: String,
    required: true,
  },
  cancelText: {
    type: String,
    default: '取消',
  },
  confirmText: {
    type: String,
    required: true,
  },
  tone: {
    type: String,
    default: 'danger',
  },
  zIndex: {
    type: Number,
    required: true,
  },
  confirmButtonRef: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['cancel', 'confirm'])
</script>

<template>
  <AccessibleDialog :open="open" :title="title" overlay-class="confirm-dialog-overlay shared-dialog-overlay" content-class="confirm-dialog shared-dialog" :z-index="zIndex" @close="emit('cancel')">
    <h2 :id="dialogId" class="confirm-dialog-title shared-dialog-title" :class="`is-${tone}`">{{ title }}</h2>
    <p class="confirm-dialog-copy shared-dialog-copy">{{ copy }}</p>
    <div class="confirm-dialog-actions">
      <button type="button" class="confirm-dialog-cancel" @click="emit('cancel')">{{ cancelText }}</button>
      <button :ref="confirmButtonRef" type="button" class="confirm-dialog-confirm" :class="`is-${tone}`" @click="emit('confirm')">{{ confirmText }}</button>
    </div>
  </AccessibleDialog>
</template>

<style>
.confirm-dialog-overlay {
  position: fixed;
  inset: 0;
}

.confirm-dialog-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.confirm-dialog {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  max-width: 340px;
  margin: auto;
  padding: 28px 24px 24px;
  border-radius: 16px;
  background: #fff;
}

.confirm-dialog-title.is-danger {
  color: #d14343;
}

.confirm-dialog-title.is-warning {
  color: #c87416;
}

.confirm-dialog-copy {
  margin: 10px 0 0;
  color: #474d66;
  font-size: 14px;
  line-height: 1.6;
}

.confirm-dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 24px;
}

.confirm-dialog-cancel,
.confirm-dialog-confirm {
  min-height: 44px;
  border-radius: 10px;
  font-size: 15px;
}

.confirm-dialog-cancel {
  border: 1px solid #d8dae5;
  background: #fff;
  color: #474d66;
  font-weight: 500;
}

.confirm-dialog-confirm {
  color: #fff;
  font-weight: 600;
}

.confirm-dialog-confirm.is-danger {
  background: #d14343;
}

.confirm-dialog-confirm.is-warning {
  background: #c87416;
}
</style>
