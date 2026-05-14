<script setup>
defineProps({
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
})

const emit = defineEmits(['change'])

function setSegment(tab) {
  emit('change', tab)
}
</script>

<template>
  <section class="content" :style="{ padding: `24px 16px ${bottomSpacing}px` }">
    <div class="segment-tabs activity-segment-tabs" role="tablist" aria-label="名單分類">
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
      <div v-for="(member, index) in members" :key="`${member.name}-${index}`" class="row activity-member-row">
        <div class="rank activity-member-rank">{{ index + 1 }}</div>
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
        <div class="name activity-member-name">
          <span>{{ member.name }}</span>
          <span v-if="member.time" class="activity-member-time">{{ member.time }}</span>
        </div>
        <div v-if="member.status" class="status-tag activity-member-status">{{ member.status }}</div>
      </div>
    </div>
    <div class="version app-version-note">{{ version }}</div>
  </section>
</template>

<style scoped>
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
</style>
