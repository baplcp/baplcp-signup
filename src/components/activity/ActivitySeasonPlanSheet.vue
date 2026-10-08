<script setup>
import { computed, ref, watch } from 'vue'
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
  // 已報名的人開啟時是管理模式：已報的方案標示已報名，還能報的方案可以續報（例如一季續報後季）。
  manage: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'confirm'])

const title = computed(() => (props.manage ? '管理季打報名' : '選擇報名方案'))

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
  <AccessibleDialog :open="open" :title="title" overlay-class="plan-overlay sliding-sheet-overlay phone-container modal-frame" content-class="plan-sheet sliding-sheet" @close="emit('close')">
    <div class="drag-handle" aria-hidden="true"></div>
    <h2 id="plan-sheet-title" class="plan-title">{{ title }}</h2>

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
  z-index: var(--layer-plan-dialog);
}

.plan-sheet {
  padding: 10px 20px calc(32px + env(safe-area-inset-bottom));
  gap: 0;
}

.drag-handle {
  width: 36px;
  height: 4px;
  border-radius: 99px;
  background: var(--neutral-300);
  margin: 0 auto 16px;
}

.plan-title {
  margin: 0 0 16px;
  font-size: 18px;
  line-height: 1.36;
  font-weight: 600;
  color: var(--text);
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
  background: var(--neutral-0);
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
  border-color: var(--secondary-500);
  border-width: 2px;
  background: #f0fdfb;
}

.plan-card-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid var(--neutral-300);
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
  border-color: var(--secondary-500);
  background: var(--secondary-500);
}

.plan-card-radio.is-on::after {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--neutral-0);
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
  color: var(--text);
}

.plan-card-meta {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--neutral-600);
}

.plan-card-fee {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--secondary-500);
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
  color: var(--text);
}

.plan-card-unit {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.25;
  color: var(--neutral-600);
}

.plan-confirm {
  width: 100%;
  min-height: 50px;
  border-radius: 10px;
  background: var(--secondary-500);
  color: var(--neutral-0);
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
}

.plan-confirm:disabled {
  background: var(--neutral-300);
  color: var(--neutral-0);
  cursor: default;
}
</style>
