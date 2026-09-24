<script setup>
import { ref, watch } from 'vue'
import AccessibleDialog from '~/components/AccessibleDialog.vue'

// plans 來自 useActiveActivityViewModels，含已截止或已開打的方案：
// 這些方案要看得到但不能選，使用者才知道它存在、為什麼不能報。
const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  plans: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['close', 'confirm'])

function firstSelectablePlan() {
  return props.plans.find(plan => plan.selectable)?.plan || ''
}

const selectedPlan = ref(firstSelectablePlan())

// 每次開啟都重新選第一個可報的方案。
watch(
  () => props.open,
  isOpen => {
    if (isOpen) selectedPlan.value = firstSelectablePlan()
  }
)

// 方案會隨活動資料載入與報名時間改變，選到的方案不再可報時要重新選。
watch(
  () => props.plans,
  () => {
    if (!props.plans.some(plan => plan.plan === selectedPlan.value && plan.selectable)) selectedPlan.value = firstSelectablePlan()
  }
)

function confirm() {
  if (!selectedPlan.value) return
  emit('confirm', selectedPlan.value)
}
</script>

<template>
  <AccessibleDialog :open="open" title="選擇報名方案" overlay-class="plan-overlay phone-container modal-frame" content-class="plan-sheet" @close="emit('close')">
    <div class="drag-handle" aria-hidden="true"></div>
    <h2 id="plan-sheet-title" class="plan-title">選擇報名方案</h2>

    <div class="plan-options">
      <button
        v-for="planOption in plans"
        :key="planOption.plan"
        class="plan-card"
        :class="{ 'is-selected': selectedPlan === planOption.plan, 'is-unselectable': !planOption.selectable }"
        type="button"
        :disabled="!planOption.selectable"
        @click="selectedPlan = planOption.plan"
      >
        <div class="plan-card-radio" :class="{ 'is-on': selectedPlan === planOption.plan }" aria-hidden="true"></div>
        <div class="plan-card-body">
          <p class="plan-card-name">
            {{ planOption.name }}
            <span v-if="planOption.unselectableReason" class="plan-card-tag">{{ planOption.unselectableReason }}</span>
          </p>
          <p class="plan-card-meta">{{ planOption.dateRange }}・{{ planOption.count }} 次</p>
          <p class="plan-card-fee">${{ planOption.feePerSession.toLocaleString() }} / 次</p>
        </div>
        <div class="plan-card-total">
          <p class="plan-card-price">${{ planOption.total.toLocaleString() }}</p>
          <p class="plan-card-unit">/人</p>
        </div>
      </button>
    </div>

    <button class="plan-confirm" type="button" :disabled="!selectedPlan" @click="confirm">確認報名</button>
  </AccessibleDialog>
</template>

<style>
.plan-overlay {
  position: fixed;
  overflow: hidden;
  left: 0;
  right: 0;
  margin: auto;
  z-index: 10003;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s ease;
}

.plan-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
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

.plan-card.is-unselectable {
  background: #f7f8fa;
  border-color: #eceef4;
  cursor: default;
}

.plan-card.is-unselectable .plan-card-name,
.plan-card.is-unselectable .plan-card-meta,
.plan-card.is-unselectable .plan-card-fee,
.plan-card.is-unselectable .plan-card-total {
  color: #9aa1b1;
}

.plan-card-tag {
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #eceef4;
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
  vertical-align: middle;
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

.plan-confirm:disabled {
  background: #d8dae5;
  color: #fff;
  cursor: default;
}
</style>
