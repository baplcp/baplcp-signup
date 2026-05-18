<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  tabs: {
    type: Array,
    required: true,
  },
  activeSegment: {
    type: String,
    required: true,
  },
  members: {
    type: Array,
    required: true,
  },
  version: {
    type: String,
    default: '',
  },
  bottomSpacing: {
    type: Number,
    default: 42,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  adminMode: {
    type: Boolean,
    default: false,
  },
  acEnabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['change', 'remove', 'toggle-payment'])

function setSegment(tab) {
  emit('change', tab)
}

const SWIPE_OPEN_WIDTH = 72

const rowOffsets = ref({})
const activeDrag = ref({ index: -1, startX: 0, startY: 0, initOffset: 0, direction: null })

watch(() => props.members, () => {
  rowOffsets.value = {}
  activeDrag.value = { index: -1, startX: 0, startY: 0, initOffset: 0, direction: null }
})

function getOffset(index) {
  return rowOffsets.value[index] ?? 0
}

function setOffset(index, x) {
  rowOffsets.value = { ...rowOffsets.value, [index]: x }
}

function rowStyle(index) {
  const x = getOffset(index)
  const isDragging = activeDrag.value.index === index && activeDrag.value.direction === 'h'
  return {
    transform: `translateX(${x}px)`,
    transition: isDragging ? 'none' : 'transform 0.25s ease',
  }
}

function onTouchStart(index, e) {
  if (!props.isAdmin || props.adminMode) return
  // 關閉其他已展開的列
  const newOffsets = {}
  Object.keys(rowOffsets.value).forEach(i => {
    newOffsets[Number(i)] = 0
  })
  rowOffsets.value = newOffsets

  activeDrag.value = {
    index,
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    initOffset: getOffset(index),
    direction: null,
  }
}

function onTouchMove(index, e) {
  const drag = activeDrag.value
  if (!props.isAdmin || props.adminMode || drag.index !== index) return

  const dx = e.touches[0].clientX - drag.startX
  const dy = e.touches[0].clientY - drag.startY

  if (!drag.direction && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    activeDrag.value = { ...drag, direction: Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v' }
    return
  }

  if (activeDrag.value.direction !== 'h') return

  e.preventDefault()
  const newX = Math.min(0, Math.max(drag.initOffset + dx, -SWIPE_OPEN_WIDTH))
  setOffset(index, newX)
}

function onTouchEnd(index) {
  const drag = activeDrag.value
  if (!props.isAdmin || props.adminMode || drag.index !== index) return

  if (drag.direction === 'h') {
    const current = getOffset(index)
    const moved = current - drag.initOffset
    setOffset(index, moved < -(SWIPE_OPEN_WIDTH / 2) ? -SWIPE_OPEN_WIDTH : 0)
  }

  activeDrag.value = { index: -1, startX: 0, startY: 0, initOffset: 0, direction: null }
}

function handleRemove(member, index) {
  setOffset(index, 0)
  emit('remove', member)
}
</script>

<template>
  <section class="content" :style="{ padding: `24px 16px ${bottomSpacing}px` }">
    <div v-if="tabs.length > 1" class="segment-tabs activity-segment-tabs" role="tablist" aria-label="名單分類">
      <button
        v-for="tab in tabs"
        :key="tab"
        class="segment-tab activity-segment-tab"
        :class="{ 'is-active': activeSegment === tab }"
        type="button"
        role="tab"
        :aria-selected="String(activeSegment === tab)"
        @click="setSegment(tab)"
      >
        {{ tab }}
      </button>
    </div>
    <div class="list activity-member-list">
      <template
        v-for="(member, index) in members"
        :key="`${member.name}-${index}`"
      >
        <div v-if="member.status === '候補' && (index === 0 || !members[index - 1].status)" class="waitlist-divider">
          <span class="waitlist-divider-label">候補</span>
        </div>
        <div class="swipe-row-container">
        <button
          v-show="isAdmin && !adminMode"
          class="swipe-delete-btn"
          type="button"
          aria-label="`移除 ${member.name}`"
          @click="handleRemove(member, index)"
        >
          移除
        </button>
        <div
          class="row activity-member-row"
          :style="(isAdmin && !adminMode) ? rowStyle(index) : undefined"
          @touchstart="onTouchStart(index, $event)"
          @touchmove="onTouchMove(index, $event)"
          @touchend="onTouchEnd(index)"
        >
          <div class="rank activity-member-rank" :class="{ 'is-waitlist': member.status === '候補' }">{{ index + 1 }}</div>
          <div class="activity-member-avatar-wrap">
            <div class="avatar activity-member-avatar" :style="member.image ? undefined : { background: member.color }">
              <img v-if="member.image" :src="member.image" alt="" />
              <template v-else>{{ member.badge }}</template>
            </div>
            <span v-if="member.gender" class="gender-badge" :class="`gender-badge--${member.gender}`" :aria-label="member.gender === 'male' ? '男' : member.gender === 'female' ? '女' : '其他'">
              <svg v-if="member.gender === 'male'" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="4.5" cy="7.5" r="3" stroke="white" stroke-width="1.6"/>
                <path d="M7 5 L11 1 M8.5 1 H11 V3.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else-if="member.gender === 'female'" viewBox="0 0 12 14" fill="none" aria-hidden="true">
                <circle cx="6" cy="5" r="3.5" stroke="white" stroke-width="1.6"/>
                <path d="M6 9 V13 M4 11 H8" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
              <svg v-else viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="4" stroke="white" stroke-width="1.6"/>
                <path d="M4 6 H8 M6 4 V8" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
          <div class="name activity-member-name" :class="{ 'is-waitlist': member.status === '候補' }">
            <span>{{ member.name }}</span>
            <span v-if="member.time" class="activity-member-time">
              {{ member.time }}<template v-if="member.addedBy"> · {{ member.addedBy }}</template>
            </span>
          </div>
          <div v-show="member.status && !adminMode" class="status-tag activity-member-status">{{ member.status }}</div>
          <div v-show="adminMode" class="payment-checks" @click.stop>
            <button
              class="pay-check-row"
              type="button"
              @click.stop="emit('toggle-payment', member, 'paid_court')"
            >
              <span class="pay-check-box" :class="{ 'is-checked': member.paidCourt }">
                <svg v-if="member.paidCourt" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                  <path d="M1 4L3.5 6.5L9 1.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="pay-check-text">場地費</span>
            </button>
            <button
              v-if="acEnabled"
              class="pay-check-row"
              type="button"
              @click.stop="emit('toggle-payment', member, 'paid_ac')"
            >
              <span class="pay-check-box" :class="{ 'is-checked': member.paidAc }">
                <svg v-if="member.paidAc" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                  <path d="M1 4L3.5 6.5L9 1.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="pay-check-text">冷氣費</span>
            </button>
          </div>
        </div>
        </div>
      </template>
    </div>
    <div class="version app-version-note">{{ version }}</div>
  </section>
</template>

<style scoped>
.activity-member-list {
  overflow-x: hidden;
}

.waitlist-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0;
}

.waitlist-divider::before,
.waitlist-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e4e7f0;
}

.waitlist-divider-label {
  color: #8f95b2;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.activity-member-rank.is-waitlist {
  color: #c1c4d6;
}

.activity-member-name.is-waitlist span:first-child {
  color: #8f95b2;
}

.swipe-row-container {
  position: relative;
}

.swipe-delete-btn {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 72px;
  background: #d14343;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  border-radius: 0 6px 6px 0;
  z-index: 1;
}

.activity-member-row {
  position: relative;
  z-index: 2;
  background: #fff;
}

.activity-member-avatar-wrap {
  position: relative;
  flex: 0 0 auto;
}

.gender-badge {
  position: absolute;
  bottom: -1px;
  right: -2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gender-badge svg {
  width: 9px;
  height: 9px;
}

.gender-badge--male { background: #5768ff; }
.gender-badge--female { background: #f06292; }
.gender-badge--other { background: #8f95b2; }

.payment-checks {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 0 0 auto;
  margin-left: auto;
}

.pay-check-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  margin: 0 -8px;
  background: none;
  border: none;
  cursor: pointer;
}

.pay-check-box {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 1.5px solid #d8dae5;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.pay-check-box.is-checked {
  background: #1bc4bf;
  border-color: #1bc4bf;
}

.pay-check-box svg {
  width: 11px;
  height: 9px;
  display: block;
}

.pay-check-text {
  font-size: 11px;
  line-height: 1.3;
  color: #696f8c;
  white-space: nowrap;
}
</style>
