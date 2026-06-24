<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  initialized: {
    type: Boolean,
    default: false,
  },
})

const base = import.meta.env.BASE_URL
const videoSrc = `${base}video/Pre-comp 1.mp4`

const progress = ref(0)
const fading = ref(false)
const done = ref(false)

let timer = null

// 假進度：前段快速推進到 80%，之後放慢等待真正的初始化完成
function startFakeProgress() {
  timer = setInterval(() => {
    if (props.initialized) return
    if (progress.value < 80) {
      progress.value = Math.min(80, progress.value + (80 - progress.value) * 0.08 + 0.5)
    } else if (progress.value < 88) {
      progress.value += 0.15
    }
  }, 40)
}

// initialized 完成後衝到 100% 然後淡出
watch(
  () => props.initialized,
  val => {
    if (!val) return
    clearInterval(timer)
    progress.value = 100
    setTimeout(() => {
      fading.value = true
      setTimeout(() => {
        done.value = true
      }, 500)
    }, 300)
  }
)

onMounted(startFakeProgress)
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <Teleport to="body">
    <div v-if="!done" class="loading-overlay" :class="{ 'is-fading': fading }" aria-label="載入中" role="status">
      <video
        class="loading-video"
        :src="videoSrc"
        autoplay
        loop
        muted
        playsinline
        preload="auto"
      />
      <div class="loading-progress-wrap">
        <div class="loading-progress-track">
          <div class="loading-progress-fill" :style="{ width: progress + '%' }" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  opacity: 1;
  transition: opacity 0.5s ease;
}

.loading-overlay.is-fading {
  opacity: 0;
  pointer-events: none;
}

.loading-video {
  width: 260px;
  max-width: 70vw;
  height: auto;
  object-fit: contain;
}

.loading-progress-wrap {
  width: 180px;
  max-width: 55vw;
}

.loading-progress-track {
  height: 10px;
  border-radius: 999px;
  background: #e8eaf0;
  overflow: hidden;
}

.loading-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #7b8fff 0%, #5768ff 100%);
  transition: width 0.25s ease-out;
}
</style>
