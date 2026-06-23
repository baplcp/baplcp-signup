<script setup>
import { ref, watch } from 'vue'

defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  quarterCount: {
    type: Number,
    required: true,
  },
  quarterDateRange: {
    type: String,
    required: true,
  },
  quarterTotal: {
    type: Number,
    required: true,
  },
  quarterFeePerSession: {
    type: Number,
    required: true,
  },
  halfYearCount: {
    type: Number,
    required: true,
  },
  halfYearDateRange: {
    type: String,
    required: true,
  },
  halfYearTotal: {
    type: Number,
    required: true,
  },
  halfYearFeePerSession: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['close', 'confirm'])

const selectedPlan = ref('quarter')

watch(
  () => false,
  () => {},
  { immediate: false }
)

function reset() {
  selectedPlan.value = 'quarter'
}

function confirm() {
  emit('confirm', selectedPlan.value)
}

defineExpose({ reset })
</script>

<template>
  <div
    class="plan-overlay phone-container modal-frame"
    :class="{ 'is-open': open }"
    :aria-hidden="String(!open)"
    :inert="!open"
  >
    <button class="plan-backdrop" type="button" aria-label="關閉方案選擇" @click="emit('close')"></button>
    <section class="plan-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-sheet-title">
      <div class="drag-handle" aria-hidden="true"></div>
      <h2 id="plan-sheet-title" class="plan-title">選擇報名方案</h2>

      <div class="plan-options">
        <button
          class="plan-card"
          :class="{ 'is-selected': selectedPlan === 'quarter' }"
          type="button"
          @click="selectedPlan = 'quarter'"
        >
          <div class="plan-card-radio" :class="{ 'is-on': selectedPlan === 'quarter' }" aria-hidden="true"></div>
          <div class="plan-card-body">
            <p class="plan-card-name">一季</p>
            <p class="plan-card-meta">{{ quarterDateRange }}・{{ quarterCount }} 次</p>
            <p class="plan-card-fee">${{ quarterFeePerSession.toLocaleString() }} / 次</p>
          </div>
          <div class="plan-card-total">
            <p class="plan-card-price">${{ quarterTotal.toLocaleString() }}</p>
            <p class="plan-card-unit">/人</p>
          </div>
        </button>

        <button
          class="plan-card"
          :class="{ 'is-selected': selectedPlan === 'half-year' }"
          type="button"
          @click="selectedPlan = 'half-year'"
        >
          <div class="plan-card-radio" :class="{ 'is-on': selectedPlan === 'half-year' }" aria-hidden="true"></div>
          <div class="plan-card-body">
            <p class="plan-card-name">半年</p>
            <p class="plan-card-meta">{{ halfYearDateRange }}・{{ halfYearCount }} 次</p>
            <p class="plan-card-fee">${{ halfYearFeePerSession.toLocaleString() }} / 次</p>
          </div>
          <div class="plan-card-total">
            <p class="plan-card-price">${{ halfYearTotal.toLocaleString() }}</p>
            <p class="plan-card-unit">/人</p>
          </div>
        </button>
      </div>

      <button class="plan-confirm" type="button" @click="confirm">確認報名</button>
    </section>
  </div>
</template>

<style scoped>
.plan-overlay {
  position: fixed;
  overflow: hidden;
  left: 0;
  right: 0;
  margin: auto;
  z-index: 10003;
  pointer-events: none;
}

.plan-overlay.is-open {
  pointer-events: auto;
}

.plan-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.28s ease;
}

.plan-overlay.is-open .plan-backdrop {
  opacity: 1;
}

.plan-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 18px 18px 0 0;
  background: #fff;
  padding: 10px 20px 32px;
  display: flex;
  flex-direction: column;
  gap: 0;
  transform: translateY(100%);
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.plan-overlay.is-open .plan-sheet {
  transform: translateY(0);
}

.drag-handle {
  width: 36px;
  height: 4px;
  border-radius: 99px;
  background: #d8dae5;
  margin: 0 auto 16px;
}

.plan-title {
  margin: 0 0 16px;
  font-size: 18px;
  line-height: 1.36;
  font-weight: 600;
  color: #101840;
}

.plan-options {
  display: grid;
  gap: 10px;
  margin-bottom: 20px;
}

.plan-card {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border: 1.5px solid #e3e6ef;
  border-radius: 12px;
  background: #fff;
  padding: 13px 14px;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
  cursor: pointer;
}

.plan-card.is-selected {
  border-color: #1bc4bf;
  border-width: 2px;
  background: #f0fdfb;
}

.plan-card-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid #d8dae5;
  flex: 0 0 auto;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.plan-card-radio.is-on {
  border-color: #1bc4bf;
  background: #1bc4bf;
}

.plan-card-radio.is-on::after {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
}

.plan-card-body {
  flex: 1;
  min-width: 0;
}

.plan-card-name {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
  color: #101840;
}

.plan-card-meta {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 1.35;
  color: #696f8c;
}

.plan-card-fee {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.35;
  color: #1bc4bf;
}

.plan-card-total {
  flex: 0 0 auto;
  text-align: right;
}

.plan-card-price {
  margin: 0;
  font-size: 17px;
  line-height: 1.4;
  font-weight: 600;
  color: #101840;
}

.plan-card-unit {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.25;
  color: #696f8c;
}

.plan-confirm {
  width: 100%;
  min-height: 50px;
  border-radius: 10px;
  background: #1bc4bf;
  color: #fff;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
}
</style>
