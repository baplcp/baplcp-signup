<script setup>
import { ref } from 'vue'
import { APP_VERSION } from '~/assets/appVersion'

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
</script>

<template>
  <main class="app-shell ended-activity-page">
    <div class="scroll-content">
      <section class="hero">
        <div class="hero-layout">
          <div class="hero-copy">
            <h1>已結束的球局</h1>
          </div>
        </div>
      </section>

      <section class="summary-card activity-summary-card" aria-label="活動摘要">
        <div class="summary-main activity-summary-main">
          <div class="summary-info activity-summary-info">
            <p class="summary-time activity-summary-time">
              <span class="summary-date activity-summary-date">12.31<span class="summary-weekday activity-summary-weekday">（日）</span></span>
              <span class="summary-separator activity-summary-separator">|</span>
              <span>12:20-15:20</span>
            </p>
            <p class="summary-location activity-summary-location">板橋柏吉倫排球場</p>
          </div>
        </div>
        <div class="summary-status activity-summary-status">
          <p class="summary-status-text activity-summary-status-text">狀態：<span class="summary-status-value">已參加</span></p>
          <div class="summary-fee activity-summary-fee" aria-label="費用 255 元，已付">
            <img class="summary-fee-money activity-summary-fee-money" src="/images/money-icon.png" alt="" aria-hidden="true" />
            <img class="summary-fee-air activity-summary-fee-air" src="/images/airconditioner-icon.png" alt="" aria-hidden="true" />
            <span class="summary-fee-amount activity-summary-fee-amount">$255</span>
            <span class="summary-fee-state activity-summary-fee-state">已付</span>
          </div>
        </div>
      </section>

      <section class="content">
        <div class="segment-tabs activity-segment-tabs" role="tablist" aria-label="名單分類">
          <button
            v-for="tab in SEGMENT_TABS"
            :key="tab"
            class="segment-tab activity-segment-tab"
            :class="{ 'is-active': activeSegment === tab }"
            type="button"
            role="tab"
            :aria-selected="String(activeSegment === tab)"
            @click="activeSegment = tab"
          >
            {{ tab }}
          </button>
        </div>
        <div class="list activity-member-list">
          <div v-for="(member, index) in MEMBERS" :key="`${member.name}-${index}`" class="row activity-member-row">
            <div class="rank activity-member-rank">{{ index + 1 }}</div>
            <div class="avatar activity-member-avatar" :style="member.image ? undefined : { background: member.color }">
              <img v-if="member.image" :src="member.image" alt="" />
              <template v-else>{{ member.badge }}</template>
            </div>
            <div class="name activity-member-name">{{ member.name }}</div>
            <div v-if="member.status" class="status-tag activity-member-status">{{ member.status }}</div>
          </div>
        </div>
        <div class="version app-version-note">{{ APP_VERSION }}</div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.ended-activity-page {
  height: 100%;
}

.scroll-content {
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

.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  margin: 0 0 -60px;
  min-height: 60px;
  background: rgba(255, 255, 255, var(--nav-bg-opacity, 0));
  backdrop-filter: blur(calc(var(--nav-progress, 0) * 14px));
  -webkit-backdrop-filter: blur(calc(var(--nav-progress, 0) * 14px));
  box-shadow: 0 1px 0 rgba(16, 24, 64, calc(var(--nav-progress, 0) * 0.08));
}

.back-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  color: #fff;
  flex: 0 0 auto;
  transition: color 0.25s ease;
}

.back-btn svg {
  width: 24px;
  height: 24px;
}

.brand {
  width: 65px;
  height: 22px;
  background: url('/images/logo-white.svg') center/contain no-repeat;
  flex: 0 0 auto;
  transition: filter 0.25s ease;
}

.nav-title {
  flex: 1;
  opacity: 0;
  font-size: 15px;
  color: #fff;
  text-align: center;
}

.menu-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.menu-btn img {
  width: 24px;
  height: 24px;
  transition: filter 0.25s ease;
}

.nav.is-scrolled {
  background: rgba(255, 255, 255, var(--nav-bg-opacity, 0.94));
}

.nav.is-scrolled .brand {
  background-image: url('/images/logo-purple.svg');
  filter: none;
}

.nav.is-scrolled .menu-btn img {
  filter: brightness(0) saturate(100%) invert(21%) sepia(27%) saturate(1897%) hue-rotate(210deg) brightness(93%) contrast(96%);
}

.nav.is-scrolled .back-btn {
  color: var(--text);
}

.hero-layout {
  position: relative;
  z-index: 1;
}

.hero-copy {
  color: #fff;
  padding-top: 0;
  transform: none;
  text-align: left;
}

.hero-copy h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.36;
  font-weight: 700;
  letter-spacing: 0.56px;
}

.summary-card {
  box-shadow: 2px 2px 28px rgba(143, 149, 178, 0.24);
}

.summary-status-value {
  color: var(--success-500);
  font-weight: 400;
}

.summary-fee-state {
  color: var(--success-500);
}

.content {
  padding: 24px 16px 60px;
}

.menu-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.menu-overlay.is-open {
  pointer-events: auto;
}

.menu-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.28s ease;
}

.menu-overlay.is-open .menu-backdrop {
  opacity: 1;
}

.side-menu {
  position: absolute;
  top: 0;
  right: 0;
  width: min(329px, calc(100% - 61px));
  height: 100%;
  padding: 32px 0;
  background: #fff;
  color: var(--text);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.side-menu::-webkit-scrollbar {
  display: none;
}

.menu-overlay.is-open .side-menu {
  transform: translateX(0);
}

.drawer-profile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px 28px;
}

.drawer-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
}

.drawer-user-stack {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 4px;
}

.drawer-user {
  margin: 0;
  font-size: 20px;
  line-height: 1.25;
  font-weight: 500;
  color: #101840;
}

.drawer-role {
  width: max-content;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid rgba(217, 141, 53, 0.3);
  border-radius: 6px;
  background: rgba(248, 222, 183, 0.2);
  color: #c79051;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 400;
  white-space: nowrap;
}

.drawer-role svg {
  display: block;
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  color: #e6b883;
}

.drawer-close {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  color: #474d66;
  align-self: flex-start;
  margin-top: 0;
  flex: 0 0 auto;
}

.drawer-content {
  display: grid;
  gap: 23px;
  flex: 1;
  padding-bottom: 32px;
}

.drawer-section {
  padding: 0 32px 0 16px;
}

.drawer-section-title {
  margin: 0 0 16px;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 400;
  color: #8f95b2;
}

.drawer-list {
  display: grid;
  gap: 20px;
}

.drawer-link {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 36px;
  color: #101840;
  text-decoration: none;
  font-size: 16px;
  line-height: 1.4;
}

.drawer-link.is-pending {
  opacity: 0.4;
  pointer-events: none;
  cursor: default;
}

.drawer-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  background: #a8b1f4;
  color: #8f95b2;
  overflow: hidden;
}

.drawer-icon img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  filter: drop-shadow(3.2px 3.2px 12px rgba(87, 104, 255, 0.55));
}

.drawer-icon.is-warm {
  background: #f2b57c;
}

.drawer-icon.is-warm img {
  filter: drop-shadow(3.8px 3.8px 14px rgba(148, 77, 27, 0.45));
}

.drawer-icon.is-muted {
  background: #edeff5;
}

.drawer-divider {
  height: 1px;
  background: #edeff5;
}

.drawer-footer {
  margin-top: auto;
  padding: 0 16px;
}

.drawer-create-button {
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #1bc4bf;
  color: #fff;
  text-decoration: none;
  font-size: 17px;
  line-height: 1.25;
  font-weight: 500;
}

@media (max-width: 380px) {
  .side-menu {
    width: 84vw;
  }

  .drawer-section {
    padding-right: 24px;
  }
}

@media (max-width: 500px) {
  body {
    padding: 0;
    display: block;
    overflow: hidden;
    background: #fff;
  }

  .app-shell {
    width: 100%;
    height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }

  .hero {
    border-radius: 0;
  }
}
</style>
