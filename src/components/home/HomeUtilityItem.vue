<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  label: {
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
  warm: {
    type: Boolean,
    default: false,
  },
  pending: {
    type: Boolean,
    default: false,
  },
  external: {
    type: Boolean,
    default: false,
  },
})

const tagName = computed(() => (props.to ? RouterLink : 'a'))

const linkAttrs = computed(() => {
  if (props.to) {
    return props.pending ? { to: props.to, 'aria-disabled': 'true', tabindex: '-1' } : { to: props.to }
  }

  return {
    href: props.pending ? '#' : props.href,
    ...(props.external ? { target: '_blank', rel: 'noreferrer' } : {}),
    ...(props.pending ? { 'aria-disabled': 'true', tabindex: '-1' } : {}),
  }
})
</script>

<template>
  <component :is="tagName" class="utility-item" :class="{ warm, 'is-pending': pending }" v-bind="linkAttrs">
    <div class="utility-icon">
      <img :src="imageSrc" alt="" />
    </div>
    <span>{{ label }}</span>
  </component>
</template>

<style scoped>
.utility-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  text-decoration: none;
  color: var(--text);
}

.utility-icon {
  width: 76px;
  height: 76px;
  position: relative;
  display: grid;
  place-items: center;
}

.utility-icon::before {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 999px;
  background: #bac5ff;
}

.utility-item.warm .utility-icon::before {
  background: #f2ba78;
}

.utility-icon img {
  position: relative;
  z-index: 1;
  width: 58px;
  height: 58px;
  object-fit: contain;
  filter: drop-shadow(3.995px 3.995px 15.279px rgba(87, 104, 255, 0.6));
}

.utility-item.warm .utility-icon img {
  width: 58px;
  height: 58px;
  filter: drop-shadow(3.995px 3.995px 15.279px rgba(148, 77, 27, 0.5));
}

.utility-item span {
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
}

.utility-item.is-pending {
  opacity: 0.4;
  pointer-events: none;
  cursor: default;
}
</style>
