<script setup>
import { ref } from 'vue'

defineProps({
  faqs: {
    type: Array,
    required: true,
  },
})

const openFaqIndexes = ref([])

function isFaqOpen(index) {
  return openFaqIndexes.value.includes(index)
}

function toggleFaq(index) {
  openFaqIndexes.value = isFaqOpen(index)
    ? openFaqIndexes.value.filter((openIndex) => openIndex !== index)
    : [...openFaqIndexes.value, index]
}
</script>

<template>
  <div class="faq-list">
    <article
      v-for="(faq, index) in faqs"
      :key="`${faq.question}-${index}`"
      class="faq-item"
      :class="{ 'is-open': isFaqOpen(index) }"
    >
      <button
        class="faq-question"
        type="button"
        :aria-expanded="String(isFaqOpen(index))"
        @click="toggleFaq(index)"
      >
        <span>{{ faq.question }}</span>
        <i class="faq-arrow" aria-hidden="true"></i>
      </button>
      <div class="faq-answer">{{ faq.answer }}</div>
    </article>
  </div>
</template>

<style scoped>
.faq-list {
  display: flex;
  flex-direction: column;
}

.faq-item {
  border-bottom: 1px solid var(--line);
  overflow-anchor: none;
}

.faq-question {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 12px;
  text-align: left;
}

.faq-question span {
  flex: 1;
  font-size: 15px;
  line-height: 1.4;
  color: var(--text);
}

.faq-arrow {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #f3f5ff;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  transition: transform 0.2s ease;
}

.faq-arrow::before {
  content: '';
  width: 7px;
  height: 7px;
  border-top: 2px solid #8e99ff;
  border-right: 2px solid #8e99ff;
  transform: rotate(45deg);
  margin-left: -2px;
}

.faq-answer {
  max-height: 0;
  overflow: hidden;
  padding: 0 12px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--muted);
  opacity: 0;
  transition:
    max-height 0.24s ease,
    opacity 0.18s ease,
    padding 0.24s ease;
}

.faq-item.is-open .faq-answer {
  max-height: 180px;
  padding: 0 12px 14px;
  opacity: 1;
}

.faq-item.is-open .faq-arrow {
  transform: rotate(90deg);
}
</style>
