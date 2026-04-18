<script setup>
  import { ref } from 'vue'

  const isMenuOpen = ref(false)

  function toggleMenu() {
    isMenuOpen.value = !isMenuOpen.value
  }

  function closeMenu() {
    isMenuOpen.value = false
  }
</script>

<template>
  <div class="h-screen md:h-[calc(100vh-48px)] overflow-hidden md:rounded-3xl w-full md:w-97.5 " >
    <header class="nav z-999">
      <RouterLink to="/" class="brand" aria-label="回到首頁 BAPLCP"></RouterLink>
      <div class="nav-title">華江高中臨打報名</div>
      <button @click="toggleMenu" class="menu-btn" type="button" aria-label="開啟選單">
        <img src="https://www.figma.com/api/mcp/asset/ef5043d5-e26f-4bcc-ab7a-2a30efead619" alt="" />
      </button>

      <div
        class="menu-overlay h-[calc(100vh-48px)]"
        :class="{ 'is-open': isMenuOpen }"
        id="menu-overlay"
        :aria-hidden="String(!isMenuOpen)"
        :inert="isMenuOpen ? null : ''"
      >
        <button @click="closeMenu" class="menu-backdrop" type="button" aria-label="關閉選單"></button>
        <aside class="side-menu" role="dialog" aria-modal="true" aria-labelledby="drawer-user-name">
          <div class="drawer-profile">
            <img class="drawer-avatar" src="/images/cookie.png" alt="" />
            <div class="drawer-user-stack">
              <p class="drawer-user" id="drawer-user-name">吳佳穎</p>
              <span class="drawer-role">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4.5 19H19.5V21H4.5V19Z" fill="currentColor" />
                  <path d="M5.5 17L4 7.5L8.5 11L12 5L15.5 11L20 7.5L18.5 17H5.5Z" fill="currentColor" />
                </svg>
                <span>偉大的主揪</span>
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
                  <span class="drawer-icon"><img src="/images/Registration list.png" alt="" /></span>
                  <span>已發起的球局</span>
                </RouterLink>
                <a class="drawer-link" href="https://store.line.me/stickershop/product/30532466/" target="_blank" rel="noreferrer">
                  <span class="drawer-icon is-warm"><img src="/images/icon-donate.png" alt="" /></span>
                  <span>贊助胖貓貓</span>
                </a>
                <RouterLink @click="closeMenu" class="drawer-link is-pending" to="/">
                  <span class="drawer-icon"><img src="/images/ball.png" alt="" /></span>
                  <span>季打報名</span>
                </RouterLink>
                <RouterLink @click="closeMenu" class="drawer-link is-pending" to="/">
                  <span class="drawer-icon"><img src="/images/icon-album.png" alt="" /></span>
                  <span>參與紀錄</span>
                </RouterLink>
              </nav>
            </section>
          </div>
          <div class="drawer-footer">
            <RouterLink class="drawer-create-button" to="/create-activity">建立新球局</RouterLink>
          </div>
        </aside>
      </div>
    </header>

    <slot />
  </div>
</template>

<style>
.nav {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
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

.brand {
  width: 65px;
  height: 22px;
  background: url('/images/logo-white.svg') center/contain no-repeat;
  flex: 0 0 auto;
  transition: filter 0.25s ease;
}

.nav-title {
  flex: 1;
  text-align: center;
  color: #fff;
  font-size: 16px;
  opacity: 0;
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
  .phone-shell {
    width: 100%;
    height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
