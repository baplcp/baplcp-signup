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
    required: true,
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
        <div class="avatar activity-member-avatar" :style="member.image ? undefined : { background: member.color }">
          <img v-if="member.image" :src="member.image" alt="" />
          <template v-else>{{ member.badge }}</template>
        </div>
        <div class="name activity-member-name">{{ member.name }}</div>
        <div v-if="member.status" class="status-tag activity-member-status">{{ member.status }}</div>
      </div>
    </div>
    <div class="version app-version-note">{{ version }}</div>
  </section>
</template>
