<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    required: true,
  },
  imageSrc: {
    type: String,
    required: true,
  },
  to: {
    type: String,
    default: '',
  },
  href: {
    type: String,
    default: '',
  },
  pending: {
    type: Boolean,
    default: false,
  },
})

const tagName = computed(() => {
  if (props.to) {
    return RouterLink
  }

  if (props.href) {
    return 'a'
  }

  return 'article'
})

const linkAttrs = computed(() => {
  if (props.to) {
    return { to: props.to }
  }

  if (props.href) {
    return { href: props.href }
  }

  return {}
})
</script>

<template>
  <component :is="tagName" class="info-card" :class="{ 'is-pending': pending }" v-bind="linkAttrs">
    <p class="info-card-title">{{ title }}</p>
    <p class="info-card-subtitle">{{ subtitle }}</p>
    <img :src="imageSrc" alt="" />
  </component>
</template>

<style scoped>
.info-card {
  position: relative;
  min-height: 78px;
  overflow: hidden;
  border-radius: 16px;
  padding: 17px 12px;
  background: linear-gradient(180deg, var(--primary-700) 0%, var(--primary-300) 100%);
  color: #fff;
  text-decoration: none;
}

.info-card-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.34px;
  line-height: 1.4;
}

.info-card-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.24px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
}

.info-card img {
  position: absolute;
  right: 4px;
  top: 3px;
  width: 72px;
  height: 72px;
  object-fit: contain;
  filter: drop-shadow(3.995px 3.995px 15.279px rgba(16, 24, 67, 0.45));
}

.info-card.is-pending {
  opacity: 0.4;
  pointer-events: none;
  cursor: default;
}
</style>
