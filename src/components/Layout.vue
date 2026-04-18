<script setup>
  function toggleMenu() {
    document.querySelector('#menu-overlay').classList.toggle('is-open')
  }

  function closeMenu() {
    document.querySelector('#menu-overlay').classList.remove('is-open')
  }
</script>

<template>
  <div class="max-w-97.5 h-[calc(100vh-48px)] overflow-hidden rounded-3xl">
    <header class="nav">
      <a class="brand" href="./index.html" aria-label="回到首頁 BAPLCP"></a>
      <div class="nav-title">華江高中臨打報名</div>
      <button @click="toggleMenu" class="menu-btn" type="button" aria-label="開啟選單">
        <img src="https://www.figma.com/api/mcp/asset/ef5043d5-e26f-4bcc-ab7a-2a30efead619" alt="" />
      </button>

      <div class="menu-overlay h-[calc(100vh-48px)]" id="menu-overlay" aria-hidden="true" inert>
        <button class="menu-backdrop" type="button" aria-label="關閉選單"></button>
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
                <a class="drawer-link" href="./group-list.html">
                  <span class="drawer-icon"><img src="/images/Registration list.png" alt="" /></span>
                  <span>已發起的球局</span>
                </a>
                <a class="drawer-link" href="https://store.line.me/stickershop/product/30532466/" target="_blank" rel="noreferrer">
                  <span class="drawer-icon is-warm"><img src="/images/icon-donate.png" alt="" /></span>
                  <span>贊助胖貓貓</span>
                </a>
                <a class="drawer-link is-pending" href="./signup.html" aria-disabled="true" tabindex="-1">
                  <span class="drawer-icon"><img src="/images/ball.png" alt="" /></span>
                  <span>季打報名</span>
                </a>
                <a class="drawer-link is-pending" href="./active-activity.html" aria-disabled="true" tabindex="-1">
                  <span class="drawer-icon"><img src="/images/icon-album.png" alt="" /></span>
                  <span>參與紀錄</span>
                </a>
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
:root {
  --page-bg: #eef1ff;
  --surface: #ffffff;
  --text: #101840;
  --muted: #65708b;
  --line: #f2f4fa;
  --hero-start: #5768ff;
  --hero-end: #8591f7;
  --card-start: #5768ff;
  --card-end: #8894ff;
  --accent-start: #ffe3c3;
  --accent-mid: #ffd2a0;
  --accent-end: #f2b47a;
  --accent-text: #774d38;
  --shadow-hero: 2px 2px 28px rgba(90, 90, 226, 0.3);
  --shadow-cat: -8px 9px 22.9px rgba(16, 24, 67, 0.45);
  --shadow-card-icon: 3.995px 3.995px 15.279px rgba(16, 24, 67, 0.45);
  --shadow-utility: 3.995px 3.995px 15.279px rgba(87, 104, 255, 0.6);
  --shadow-utility-warm: 3.995px 3.995px 15.279px rgba(148, 77, 27, 0.5);
  --shadow-button: 1px 7px 21.3px rgba(27, 17, 75, 0.45);
  --radius-xl: 24px;
  --radius-lg: 20px;
  --radius-md: 16px;
  --radius-pill: 999px;
  --nav-height: 60px;
  --brand-purple-filter: brightness(0) saturate(100%) invert(21%) sepia(27%) saturate(1897%) hue-rotate(210deg) brightness(93%) contrast(96%);
}

html {
  min-height: 100%;
  background: #eef1ff;
  color-scheme: light;
}

/* body {
  margin: 0;
  min-height: 100vh;
  font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  background-color: #eef1ff;
  background: radial-gradient(circle at top, rgba(87, 104, 255, 0.16), transparent 28%), linear-gradient(180deg, #f5f7ff 0%, #eef1ff 100%);
  color: var(--text);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 16px;
  overflow: hidden;
} */

img {
  display: block;
  max-width: 100%;
}

button {
  font: inherit;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
}

.app-shell {
  width: 100%;
  display: flex;
  justify-content: center;
}

.phone-shell {
  width: min(100%, 390px);
  height: min(844px, calc(100vh - 48px));
  background: var(--surface);
  border-radius: 23px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(71, 82, 163, 0.18);
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
}

.phone-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  height: 100%;
  overflow-anchor: none;
}

.phone-scroll::-webkit-scrollbar {
  display: none;
}

.hero {
  position: relative;
  min-height: 274px;
  padding: 44px 0 106px;
  background: linear-gradient(180deg, var(--hero-start) 0%, var(--hero-end) 100%);
  box-shadow: var(--shadow-hero);
  overflow: hidden;
}

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

.hero-content {
  display: grid;
  grid-template-columns: 170px 1fr;
  gap: 8px;
  padding: 22px 14px 0 0;
  align-items: center;
  margin-top: -36px;
}

.hero-cat {
  position: relative;
  height: 188px;
  margin-top: 26px;
  overflow: visible;
}

.hero-cat img.cat-main {
  position: absolute;
  left: -2px;
  top: -18px;
  width: 210px;
  height: 224px;
  object-fit: contain;
  filter: drop-shadow(var(--shadow-cat));
}

.hero-copy {
  padding-right: 14px;
  color: #fff;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-copy h1 {
  margin: 0 0 6px;
  font-size: 28px;
  line-height: 1.36;
  font-weight: 700;
  letter-spacing: 0.56px;
}

.hero-copy p {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  text-align: center;
}

.cta {
  margin-top: 10px;
  width: 100%;
  max-width: 182px;
  padding: 12px 24px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--accent-start) 6.25%, var(--accent-mid) 47.596%, var(--accent-end) 100%);
  color: var(--accent-text);
  font-size: 16px;
  font-weight: 500;
  box-shadow: var(--shadow-button);
}

.content {
  position: relative;
  margin-top: -124px;
  background: var(--surface);
  border-radius: 20px 20px 0 0;
  padding: 30px 16px 40px;
  min-height: calc(100% - 251px);
  z-index: 1;
}

.top-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.info-card {
  position: relative;
  min-height: 78px;
  overflow: hidden;
  border-radius: 16px;
  padding: 17px 12px;
  background: linear-gradient(180deg, var(--card-start) 0%, var(--card-end) 100%);
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
  filter: drop-shadow(var(--shadow-card-icon));
}

.info-card.is-pending,
.utility-item.is-pending,
.drawer-link.is-pending {
  opacity: 0.4;
  pointer-events: none;
  cursor: default;
}

.section {
  margin-top: 28px;
}

.section h2 {
  margin: 0 0 12px;
  font-size: 20px;
  line-height: 1.4;
  font-weight: 600;
}

.utility-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

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
  filter: drop-shadow(var(--shadow-utility));
}

.utility-item.warm .utility-icon img {
  width: 58px;
  height: 58px;
  filter: drop-shadow(var(--shadow-utility-warm));
}

.utility-item span {
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
}

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

.app-version {
  margin-top: 28px;
  text-align: center;
  font-size: 11px;
  line-height: 1.4;
  color: #7a84a7;
  font-variant-numeric: tabular-nums;
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
  body {
    padding: 0;
    background: #fff;
    overflow: hidden;
    display: flex;
  }

  .app-shell {
    width: 100%;
    height: 100vh;
  }

  .phone-shell {
    width: 100%;
    height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }

  .phone-scroll {
    overflow-y: auto;
  }

  .app-version {
    margin: 20px 0 12px;
  }
}
</style>