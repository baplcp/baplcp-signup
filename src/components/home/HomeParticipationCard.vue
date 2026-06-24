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
      <span class="title-text">累積參與次數</span>
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
/* Figma: rounded-[14px], shadow-[0px_4px_24.4px_0px_rgba(98,86,86,0.25)], bg-white */
/* Layout uses absolute positions from Figma: title top:16, goal top:59, bar top:85 */
.participation-card {
  position: relative;
  background: #f6f8fb;
  border: 1px solid #e6e8f0;
  border-radius: 14px;
  height: 111px;
  overflow: hidden;
}

/* Figma: left:16px, top:16px, gap:4px */
.title-row {
  position: absolute;
  left: 16px;
  top: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Figma: size:25px */
.burn-icon {
  width: 25px;
  height: 25px;
  object-fit: contain;
  flex-shrink: 0;
}

/* Figma: text-[19px], PingFang TC Medium, leading-[1.4], color #101840 */
.title-text {
  font-size: 19px;
  font-weight: 500;
  color: #101840;
  line-height: 1.4;
  white-space: nowrap;
}

/* Figma: left:13px, top:59px, text-[14px], PingFang TC Semibold, color #f1ad7c */
.goal-text {
  position: absolute;
  left: 13px;
  top: 59px;
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  color: #ee927c;
  line-height: 1.4;
  white-space: nowrap;
}

/* Figma: left:15px, top:85px, w:321px → use right:15px for responsive, h:10px */
.bar-track {
  position: absolute;
  left: 15px;
  right: 15px;
  top: 85px;
  height: 10px;
  border-radius: 25px;
  background: #e6e8f0;
  overflow: hidden;
}

/* Figma: gradient from #f2b57c to #e8677b */
.bar-fill {
  height: 100%;
  border-radius: 25px;
  background: linear-gradient(to right, #f2b57c, #e8677b);
  transition: width 0.4s ease;
}

/* Figma: text-[63.96px], SF Pro Rounded Bold, leading-none, color #101840 */
/* Position: right edge at ~29px from card right (351px card: calc(50%+146.5px) - translateX(-100%)) */
.count-num {
  position: absolute;
  right: 20px;
  top: calc(50% - 43px);
  font-size: 64px;
  font-weight: 700;
  color: #101840;
  line-height: 1;
  letter-spacing: -2px;
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
  background: linear-gradient(90deg, #e6e8f0 25%, #f0f2f7 50%, #e6e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease infinite;
}

.count-skeleton {
  width: 72px;
  height: 64px;
  border-radius: 10px;
}

.text-skeleton--goal {
  width: 72px;
  height: 16px;
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
