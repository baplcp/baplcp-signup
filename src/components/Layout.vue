<script setup>
import { ref, computed, watch, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiffStore } from '~/stores/liff'

const route = useRoute()
const router = useRouter()
const liffStore = useLiffStore()
const scrollBox = useTemplateRef('scrollBox')

const isIndexPage = computed(() => route.name === 'index')
const isMenuOpen = ref(false)

const ROLE_CONFIG = {
  organizer: { label: '偉大的主揪', modifier: 'is-organizer' },
  engineer: { label: '苦命的工程師', modifier: 'is-engineer' },
  member: { label: '一般會員', modifier: 'is-member' },
}
const roleConfig = computed(() => ROLE_CONFIG[liffStore.role] ?? ROLE_CONFIG.member)
const isOrganizer = computed(() => liffStore.role === 'organizer')
const navScrollProgress = ref(0)

const headerMode = computed(() => route.meta.header ?? 'default')
const isShowHeader = computed(() => headerMode.value !== 'none')
const isShowSimpleHeader = computed(() => headerMode.value === 'simple')
const navBackgroundOpacity = computed(() => navScrollProgress.value * 0.94)
const isNavScrolled = computed(() => navScrollProgress.value > 0.55)
const navStyle = computed(() => ({
  '--nav-progress': String(navScrollProgress.value),
  '--nav-bg-opacity': String(navBackgroundOpacity.value),
}))

function setNavScrollProgress(progress) {
  navScrollProgress.value = Math.max(0, Math.min(Number(progress) || 0, 1))
}

const NAV_FADE_DISTANCE = 120
function handleScroll(event) {
  setNavScrollProgress(event.currentTarget.scrollTop / NAV_FADE_DISTANCE)
}

function resetNavScrollState() {
  navScrollProgress.value = 0
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

function closeMenu() {
  isMenuOpen.value = false
}

function goBack() {
  const state = window.history.state
  const from = state?.__inAppFrom
  const fallbackFrom = state?.__inAppFallbackFrom

  if (typeof from === 'string' && from.startsWith('/')) {
    router.replace({
      path: from,
      state: {
        __inAppFrom: typeof fallbackFrom === 'string' && fallbackFrom.startsWith('/') ? fallbackFrom : '/',
        __inAppFallbackFrom: '/',
        __skipInAppFromUpdate: true,
      },
    })
  } else {
    router.replace({ name: 'index' })
  }
}

watch(
  () => route.fullPath,
  () => {
    closeMenu()
    resetNavScrollState()
    scrollBox.value?.scrollTo(0, 0)
  }
)
</script>

<template>
  <div ref="scrollBox" @scroll.passive="handleScroll" class="layout phone-container h-screen md:h-[calc(100vh-48px)] overflow-x-hidden overflow-y-auto md:rounded-3xl">
    <header v-if="isShowSimpleHeader" class="simple-header">
      <button @click="goBack" class="icon-button" id="back-button" type="button" aria-label="返回上一頁">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <RouterLink v-if="isOrganizer && route.name === 'group-list'" class="manage-link" to="/manage-activities">管理</RouterLink>
    </header>
    <header v-else-if="isShowHeader" class="nav" :class="{ 'is-scrolled': isNavScrolled }" :style="navStyle">
      <button v-if="!isIndexPage" class="back-btn" type="button" aria-label="返回上一頁" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <RouterLink to="/" class="brand mr-auto" aria-label="回到首頁 BAPLCP"></RouterLink>
      <span id="nav-extra"></span>
      <button @click="toggleMenu" class="menu-btn" type="button" aria-label="開啟選單">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4.5 7H19.5M4.5 12H19.5M4.5 17H19.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <div class="menu-overlay h-screen md:h-[calc(100vh-48px)]" :class="{ 'is-open': isMenuOpen }" id="menu-overlay" :aria-hidden="String(!isMenuOpen)" :inert="isMenuOpen ? null : ''">
        <button @click="closeMenu" class="menu-backdrop" type="button" aria-label="關閉選單"></button>
        <aside class="side-menu" role="dialog" aria-modal="true" aria-labelledby="drawer-user-name">
          <div class="drawer-profile">
            <!-- 已登入：顯示 LINE 頭像或 cookie 備用圖 -->
            <img v-if="liffStore.userId" class="drawer-avatar" :src="liffStore.pictureUrl || '/images/cookie.png'" alt="" />
            <!-- 未登入：灰色人頭預設圖 -->
            <span v-else class="drawer-avatar drawer-avatar--guest" aria-hidden="true">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" fill="#edeff5" r="31" />
                <g fill="#c1c7e0">
                  <path d="m56.877 50.4748a31.0647 31.0647 0 0 0 -49.7651-.0156 30.9669 30.9669 0 0 0 49.7651.0156z" />
                  <circle cx="32" cy="22" r="12" />
                </g>
              </svg>
            </span>
            <div class="drawer-user-stack">
              <p class="drawer-user" id="drawer-user-name">{{ liffStore.displayName || '訪客' }}</p>
              <!-- 未登入：請先登入 badge -->
              <span v-if="!liffStore.userId" class="drawer-role is-guest">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8" />
                  <path d="M4.5 19.5C4.5 16.186 7.686 13.5 12 13.5C16.314 13.5 19.5 16.186 19.5 19.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
                <span>請先登入</span>
              </span>
              <!-- 季打身份 badge -->
              <span v-if="liffStore.isSeason" class="drawer-role is-season">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8" />
                  <path d="M12 4C12 4 9 7 9 12C9 17 12 20 12 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  <path d="M12 4C12 4 15 7 15 12C15 17 12 20 12 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  <path d="M4 12H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
                <span>黃金季打</span>
              </span>
              <!-- 已登入：顯示對應身份 badge -->
              <span v-else class="drawer-role" :class="roleConfig.modifier">
                <!-- organizer: 皇冠 -->
                <svg v-if="liffStore.role === 'organizer'" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4.5 19H19.5V21H4.5V19Z" fill="currentColor" />
                  <path d="M5.5 17L4 7.5L8.5 11L12 5L15.5 11L20 7.5L18.5 17H5.5Z" fill="currentColor" />
                </svg>
                <!-- engineer: 程式碼括號 -->
                <svg v-else-if="liffStore.role === 'engineer'" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8 6L2 12L8 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M16 6L22 12L16 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <!-- member: 人像 -->
                <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8" />
                  <path d="M4.5 19.5C4.5 16.186 7.686 13.5 12 13.5C16.314 13.5 19.5 16.186 19.5 19.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
                <span>{{ roleConfig.label }}</span>
              </span>
            </div>
            <button @click="closeMenu" class="drawer-close" type="button" data-menu-close aria-label="關閉選單">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
                <path d="M7 7L17 17M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div class="drawer-content">
            <section class="drawer-section" aria-labelledby="drawer-common-title">
              <h2 class="drawer-section-title" id="drawer-common-title">常用功能</h2>
              <nav class="drawer-list" aria-label="常用功能">
                <RouterLink @click="closeMenu" class="drawer-link" to="/group-list">
                  <span class="drawer-icon"><img src="/images/icon-Calendar.png" alt="" /></span>
                  <span>球局列表</span>
                </RouterLink>
                <a class="drawer-link" href="https://store.line.me/stickershop/product/30532466/" target="_blank" rel="noreferrer">
                  <span class="drawer-icon is-warm"><img src="/images/icon-donate.png" alt="" /></span>
                  <span>贊助胖貓貓</span>
                </a>
                <RouterLink @click="closeMenu" class="drawer-link" to="/season-list">
                  <span class="drawer-icon"><img src="/images/ball.png" alt="" /></span>
                  <span>季打報名</span>
                </RouterLink>
              </nav>
            </section>
            <section v-if="isOrganizer" class="drawer-section" aria-labelledby="drawer-admin-title">
              <h2 class="drawer-section-title drawer-section-title--admin" id="drawer-admin-title">管理員專區</h2>
              <nav class="drawer-list" aria-label="管理員專區">
                <RouterLink @click="closeMenu" class="drawer-link" to="/season-refund">
                  <span class="drawer-icon is-refund">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="20" height="20">
                      <path d="M3 12C3 7.029 7.029 3 12 3C14.485 3 16.745 3.99 18.414 5.586" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <path d="M21 12C21 16.971 16.971 21 12 21C9.515 21 7.255 20.01 5.586 18.414" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      <path d="M18 2L18.414 5.586L15 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M6 22L5.586 18.414L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M9 12H15M12 9V15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <span>季打退費</span>
                </RouterLink>
              </nav>
            </section>
          </div>
          <div class="drawer-footer">
            <RouterLink v-if="isOrganizer" @click="closeMenu" class="drawer-create-button" to="/create-activity">建立新球局</RouterLink>
          </div>
        </aside>
      </div>
    </header>

    <!-- 外部瀏覽器阻擋畫面：偵測到非 LINE 內建瀏覽器時顯示 -->
    <div v-if="liffStore.initialized && liffStore.isExternalBrowser" class="external-wall" aria-live="assertive" role="alert">
      <div class="external-wall__card">
        <div class="external-wall__icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect width="64" height="64" rx="16" fill="#06C755"/>
            <path d="M32 12C21.51 12 13 19.16 13 28C13 35.56 18.97 41.87 27.16 43.6C27.72 43.72 28.08 44.26 27.96 44.82L27.05 49.16C26.91 49.84 27.57 50.39 28.2 50.1C37.35 45.93 51 37.59 51 28C51 19.16 42.49 12 32 12Z" fill="white"/>
          </svg>
        </div>
        <h1 class="external-wall__title">請在 LINE 中開啟</h1>
        <p class="external-wall__body">
          此服務需要在 LINE App 中使用<br>
          請回到 LINE 群組，點擊連結開啟
        </p>
      </div>
    </div>

    <slot v-else />
  </div>
</template>

<style>
.layout {
  box-shadow: 0 24px 60px rgba(71, 82, 163, 0.18);
  background: var(--surface);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  overflow-anchor: none;
  overscroll-behavior-y: none;
}

.layout::-webkit-scrollbar {
  display: none;
}

.nav {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  min-height: var(--nav-height);
  margin-bottom: calc(var(--nav-height) * -1);
  background: rgba(255, 255, 255, var(--nav-bg-opacity, 0));
  backdrop-filter: blur(calc(var(--nav-progress, 0) * 14px));
  -webkit-backdrop-filter: blur(calc(var(--nav-progress, 0) * 14px));
  box-shadow: 0 1px 0 rgba(16, 24, 64, calc(var(--nav-progress, 0) * 0.08));
  transition: filter 0.25s ease;
}

.nav.is-scrolled .back-btn {
  color: var(--primary-700);
}

.simple-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 60px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid rgba(16, 24, 64, 0.06);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.simple-header .icon-button {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  color: #667095;
  flex: 0 0 auto;
}

.manage-link {
  margin-left: auto;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 400;
  color: var(--primary-700);
  text-decoration: none;
}

.brand {
  width: 65px;
  height: 22px;
  background: url('/images/logo-white.svg') center/contain no-repeat;
  flex: 0 0 auto;
  transition: filter 0.25s ease;
}

.menu-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.menu-btn svg {
  width: 24px;
  height: 24px;
  color: #fff;
  transition: filter 0.25s ease;
}

.nav.is-scrolled {
  background: rgba(255, 255, 255, var(--nav-bg-opacity, 0.94));
}

.nav.is-scrolled .brand {
  background-image: url('/images/logo-purple.svg');
  filter: none;
}

.nav.is-scrolled .menu-btn svg {
  filter: var(--brand-purple-filter);
}

.drawer-link.is-pending {
  opacity: 0.4;
  pointer-events: none;
  cursor: default;
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
  overflow: hidden;
  transform: translateX(100%);
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
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

.drawer-avatar--guest svg {
  width: 64px;
  height: 64px;
  display: block;
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
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 400;
  white-space: nowrap;
  border: 1px solid rgba(143, 149, 178, 0.3);
  background: rgba(237, 239, 245, 0.4);
  color: #8f95b2;
}

.drawer-role svg {
  display: block;
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.drawer-role.is-organizer {
  border-color: rgba(217, 141, 53, 0.3);
  background: rgba(248, 222, 183, 0.2);
  color: #c79051;
}

.drawer-role.is-engineer {
  border-color: rgba(87, 104, 255, 0.25);
  background: rgba(168, 177, 244, 0.15);
  color: #5768ff;
}

.drawer-role.is-guest {
  border-color: rgba(143, 149, 178, 0.25);
  background: rgba(237, 239, 245, 0.5);
  color: #a8b1cc;
}

.drawer-role.is-season {
  border-color: rgba(27, 196, 191, 0.3);
  background: rgba(27, 196, 191, 0.08);
  color: #0e9b97;
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
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  overscroll-behavior-y: none;
}

.drawer-content::-webkit-scrollbar {
  display: none;
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
}

.drawer-icon.is-warm {
  background: #f2b57c;
}

.drawer-icon.is-warm img {
}

.drawer-icon.is-muted {
  background: #edeff5;
}

.drawer-icon.is-refund {
  background: #f8deb7;
  color: #c79051;
}

.drawer-section-title--admin {
  color: #c79051;
}

.drawer-divider {
  height: 1px;
  background: #edeff5;
}

.drawer-footer {
  flex-shrink: 0;
  padding: 16px 16px 0;
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

.back-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  color: #fff;
  flex: 0 0 auto;
  transition: color 0.25s ease;
}

.external-wall {
  position: absolute;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--surface, #fff);
}

.external-wall__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
  max-width: 280px;
}

.external-wall__icon {
  width: 72px;
  height: 72px;
  flex: 0 0 auto;
}

.external-wall__icon svg {
  width: 72px;
  height: 72px;
  display: block;
}

.external-wall__title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
  color: #101840;
}

.external-wall__body {
  margin: 0;
  font-size: 15px;
  line-height: 1.7;
  color: #8f95b2;
}

@media (max-width: 380px) {
  .side-menu {
    width: 84vw;
  }

  .drawer-section {
    padding-right: 24px;
  }
}
</style>
