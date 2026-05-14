<script setup>
import { computed, ref, watch } from 'vue'
import Layout from '~/components/Layout.vue'
import { useLiffStore } from '~/stores/liff'

const liffStore = useLiffStore()

const dismissed = ref(false)
const selectedGender = ref('')
const saving = ref(false)

const showGenderPrompt = computed(() =>
  liffStore.initialized &&
  !!liffStore.userId &&
  liffStore.gender === null &&
  !dismissed.value
)

// 每次 prompt 出現時重置選擇
watch(showGenderPrompt, (val) => {
  if (val) selectedGender.value = ''
})

async function confirmGender() {
  if (!selectedGender.value || saving.value) return
  saving.value = true
  await liffStore.updateGender(selectedGender.value)
  saving.value = false
}

function skipGender() {
  dismissed.value = true
}
</script>

<template>
  <Layout>
    <RouterView />
  </Layout>

  <div
    class="gender-prompt-overlay shared-dialog-overlay"
    :class="{ 'is-open': showGenderPrompt }"
    :aria-hidden="String(!showGenderPrompt)"
    :inert="!showGenderPrompt"
  >
    <section class="shared-dialog gender-prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="gender-prompt-title">
      <h2 class="shared-dialog-title" id="gender-prompt-title">請設定你的性別</h2>
      <p class="shared-dialog-copy">性別資訊用於統計男女比，設定一次即可，之後可在報名名單查看。</p>
      <div class="gender-options">
        <button
          v-for="opt in [{ value: 'female', label: '女' }, { value: 'male', label: '男' }, { value: 'other', label: '其他' }]"
          :key="opt.value"
          class="gender-option-btn"
          :class="{ 'is-selected': selectedGender === opt.value }"
          type="button"
          @click="selectedGender = opt.value"
        >{{ opt.label }}</button>
      </div>
      <button
        class="shared-dialog-button gender-confirm-btn"
        type="button"
        :disabled="!selectedGender || saving"
        @click="confirmGender"
      >確認</button>
      <button class="gender-skip-btn" type="button" @click="skipGender">稍後再說</button>
    </section>
  </div>
</template>

<style scoped>
.gender-prompt-overlay {
  z-index: 20000;
}

.gender-prompt-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gender-options {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.gender-option-btn {
  min-width: 72px;
  min-height: 44px;
  border-radius: 999px;
  border: 1.5px solid #d8dae5;
  background: #fff;
  color: #474d66;
  font-size: 16px;
  font-weight: 500;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.gender-option-btn.is-selected {
  border-color: #5768ff;
  background: #eef1ff;
  color: #5768ff;
}

.gender-confirm-btn:disabled {
  background: #d8dae5;
  cursor: default;
}

.gender-skip-btn {
  margin-top: 12px;
  color: #8f95b2;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 400;
}
</style>
