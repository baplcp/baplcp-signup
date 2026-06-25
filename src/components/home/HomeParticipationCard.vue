<script setup>
import { computed } from 'vue'

const props = defineProps({
  count: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const MILESTONES = [5, 10, 20, 30, 40, 50]

const currentGoal = computed(() => {
  return MILESTONES.find(m => props.count < m) ?? 50
})

const progressPercent = computed(() => {
  return Math.min(Math.round((props.count / currentGoal.value) * 100), 100)
})

const iconBurn = import.meta.env.BASE_URL + 'images/icon-burn.png'
</script>

<template>
  <div class="participation-card">
    <div class="title-row">
      <img :src="iconBurn" alt="" class="burn-icon" />
      <span class="title-text">累積次數</span>
    </div>
    <p class="goal-text">
      <span v-if="loading" class="text-skeleton text-skeleton--goal" />
      <template v-else>目標 {{ currentGoal }} 次</template>
    </p>
    <div class="bar-track">
      <div v-if="loading" class="bar-skeleton" />
      <div v-else class="bar-fill" :style="{ width: progressPercent + '%' }" />
    </div>
    <div class="count-num">
      <span v-if="loading" class="count-skeleton" />
      <span v-else>{{ count }}</span>
    </div>
  </div>
</template>

<style scoped>
.participation-card {
  position: relative;
  background: #f4f6fa;
  border: 1px solid #e6e8f0;
  border-radius: 14px;
  height: 78px;
  overflow: hidden;
}

.title-row {
  position: absolute;
  left: 11.5px;
  top: 14px;
  display: flex;
  align-items: center;
  gap: 2px;
}

.burn-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  flex-shrink: 0;
}

.title-text {
  font-size: 17px;
  font-weight: 500;
  color: #101840;
  line-height: 1.4;
  white-space: nowrap;
}

.goal-text {
  position: absolute;
  left: 11.5px;
  top: 41px;
  margin: 0;
  font-size: 10px;
  font-weight: 400;
  color: #6373fd;
  line-height: 1.4;
  white-space: nowrap;
}

.bar-track {
  position: absolute;
  left: 11.5px;
  right: 11.5px;
  top: 59px;
  height: 8px;
  border-radius: 25px;
  background: #d8dae5;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 25px;
  background: linear-gradient(to left, #5768ff, #8894ff);
  transition: width 0.4s ease;
}

.count-num {
  position: absolute;
  right: 12px;
  top: 12px;
  font-size: 40px;
  font-weight: 700;
  color: #101840;
  line-height: 1;
  letter-spacing: -1px;
}

@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

.count-skeleton,
.text-skeleton,
.bar-skeleton {
  display: inline-block;
  border-radius: 8px;
  background: linear-gradient(90deg, #d8dae5 25%, #eaecf4 50%, #d8dae5 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease infinite;
}

.count-skeleton {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.text-skeleton--goal {
  width: 52px;
  height: 12px;
  border-radius: 6px;
  vertical-align: middle;
}

.bar-skeleton {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 25px;
}
</style>
