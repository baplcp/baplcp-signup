<script setup>
defineProps({
  label: {
    type: String,
    required: true,
  },
  members: {
    type: Array,
    required: true,
  },
  showMeta: {
    type: Boolean,
    default: true,
  },
})
</script>

<template>
  <div class="cancelled-section">
    <div class="cancelled-divider">
      <span class="cancelled-divider-label">{{ label }}</span>
    </div>
    <div class="cancelled-list">
      <div v-for="(member, index) in members" :key="`${label}-${member.name}-${index}`" class="cancelled-row">
        <div class="cancelled-avatar">
          <img v-if="member.image" :src="member.image" alt="" />
          <template v-else>{{ member.badge }}</template>
        </div>
        <div class="cancelled-info">
          <span class="cancelled-name">{{ member.name }}</span>
          <span v-if="showMeta && (member.time || member.addedBy)" class="cancelled-meta"> {{ member.time }}<template v-if="member.time && member.addedBy"> · </template>{{ member.addedBy }} </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cancelled-section {
  padding: 0 16px 110px;
}

.cancelled-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0;
}

.cancelled-divider::before,
.cancelled-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e4e7f0;
}

.cancelled-divider-label {
  color: #8f95b2;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 500;
  white-space: nowrap;
}

.cancelled-list {
  display: grid;
}

.cancelled-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
}

.cancelled-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e4e7f0;
  color: #8f95b2;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: 0 0 auto;
  opacity: 0.6;
}

.cancelled-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cancelled-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cancelled-name {
  font-size: 14px;
  color: #8f95b2;
  line-height: 1.4;
}

.cancelled-meta {
  font-size: 12px;
  color: #b0b5cc;
  line-height: 1.4;
  margin-top: 1px;
}
</style>
