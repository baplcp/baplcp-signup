<script setup>
import { ref } from 'vue'
import { APP_VERSION } from '~/assets/appVersion'
import ActivityMemberSection from '~/components/activity/ActivityMemberSection.vue'
import ActivitySummaryCard from '~/components/activity/ActivitySummaryCard.vue'

const SEGMENT_TABS = ['全部', '臨打', '季打']
const MEMBERS = [
  { name: '莊則元', badge: '莊', image: import.meta.env.BASE_URL + '/images/profile01.png' },
  { name: '施政維', badge: '施', image: import.meta.env.BASE_URL + '/images/profile02.png' },
  { name: '莊宸豪', badge: '莊', image: import.meta.env.BASE_URL + '/images/profile03.png' },
  { name: '蔚', badge: '蔚', image: import.meta.env.BASE_URL + '/images/profile04.png' },
  { name: '乃瑄', badge: '乃', image: import.meta.env.BASE_URL + '/images/profile05.png' },
  { name: '莊辰豪', badge: '莊', image: import.meta.env.BASE_URL + '/images/profile06.png' },
  { name: '黃品諭', badge: '黃', image: import.meta.env.BASE_URL + '/images/profile07.png', status: '候補' },
  { name: '黃品翰', badge: '黃', color: 'linear-gradient(135deg, #b59dc8 0%, #8468a0 100%)', status: '候補' },
]

const activeSegment = ref(SEGMENT_TABS[0])

function setSegmentTab(tab) {
  activeSegment.value = tab
}
</script>

<template>
  <main class="ended-activity-page">
    <section class="hero">
      <div class="hero-layout">
        <div class="hero-title">
          <h1>已結束的球局</h1>
        </div>
      </div>
    </section>

    <ActivitySummaryCard
      date="12.31"
      weekday="日"
      time="12:20-15:20"
      location="板橋柏吉倫排球場"
      status-label="狀態"
      status-value="已參加"
      status-tone="success"
      fee-amount="255"
      fee-state="已付"
      fee-aria-label="費用 255 元，已付"
      fee-state-tone="success"
      shadow-tone="muted"
    />

    <ActivityMemberSection :tabs="SEGMENT_TABS" :active-segment="activeSegment" :members="MEMBERS" :version="APP_VERSION" :bottom-spacing="60" @change="setSegmentTab" />
  </main>
</template>

<style scoped>
.ended-activity-page {
  height: 100%;
  background: linear-gradient(180deg, #8f95b2 0%, #9ba0ba 7%, #adb2c8 13%, #ccd0dc 20%, #eceef4 27%, #fff 35%, #fff 100%);
}

.hero {
  position: relative;
  background: transparent;
  padding: 78px 16px 92px;
  min-height: 219px;
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: none;
  pointer-events: none;
}

.hero-layout {
  position: relative;
  z-index: 1;
}

.hero-title {
  color: #fff;
  padding-top: 0;
  transform: none;
  text-align: left;
}

.hero-title h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.36;
  font-weight: 700;
  letter-spacing: 0.56px;
}
</style>
