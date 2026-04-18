<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  var APP_VERSION = 'v2026.04.15-03'
  var scrollContainer = document.querySelector('.phone-scroll')
  var nav = document.querySelector('.nav')
  var appVersion = document.getElementById('app-version')

  if (appVersion) {
    appVersion.textContent = APP_VERSION
  }

  function syncHeaderState() {
    if (!scrollContainer || !nav) return
    var fadeDistance = 120
    var progress = Math.max(0, Math.min(scrollContainer.scrollTop / fadeDistance, 1))
    nav.style.setProperty('--nav-progress', String(progress))
    nav.style.setProperty('--nav-bg-opacity', String(progress * 0.94))
    nav.classList.toggle('is-scrolled', progress > 0.55)
  }

  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', syncHeaderState, { passive: true })
    syncHeaderState()
  }

  function initSideMenu() {
    var shell = document.querySelector('.phone-shell')
    var overlay = document.getElementById('menu-overlay')
    var openButton = document.querySelector('.menu-btn')

    if (!shell || !overlay || !openButton) return

    function setMenuOpen(isOpen) {
      shell.classList.toggle('menu-open', isOpen)
      overlay.classList.toggle('is-open', isOpen)
      overlay.setAttribute('aria-hidden', String(!isOpen))
      overlay.inert = !isOpen

      var focusTarget = isOpen ? overlay.querySelector('.drawer-close') : openButton
      if (focusTarget) {
        focusTarget.focus({ preventScroll: true })
      }
    }

    openButton.addEventListener('click', function () {
      setMenuOpen(true)
    })

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
        setMenuOpen(false)
      }
    })
  }

  initSideMenu()

  document.querySelectorAll('.faq-question').forEach(function (button) {
    button.addEventListener('click', function () {
      var item = button.closest('.faq-item')
      var expanded = button.getAttribute('aria-expanded') === 'true'
      button.setAttribute('aria-expanded', String(!expanded))
      item.classList.toggle('is-open', !expanded)
    })
  })
})
</script>

<template>
  <div class="phone-scroll">
    <section class="hero">
      <div class="hero-content">
        <div class="hero-cat" aria-hidden="true">
          <img class="cat-main" src="/images/hero-cat.png" alt="" />
        </div>

        <div class="hero-copy">
          <h1>球局報名區</h1>
          <p>最新臨打報名及季打請假</p>
          <RouterLink to="/active-activity" class="cta">立即前往</RouterLink>
        </div>
      </div>
    </section>

    <section class="content">
      <div class="top-cards">
        <RouterLink to="/group-list" class="info-card">
          <p class="info-card-title">球局列表</p>
          <p class="info-card-subtitle">各週人員名單</p>
          <img src="/images/card-party.png" alt="" />
        </RouterLink>
        <article class="info-card is-pending">
          <p class="info-card-title">我的紀錄</p>
          <p class="info-card-subtitle">報名與請假</p>
          <img src="/images/card-calendar.png" alt="" />
        </article>
      </div>

      <section class="section" aria-labelledby="utility-title">
        <h2 id="utility-title">常用功能</h2>
        <div class="utility-grid">
          <a class="utility-item warm" href="https://store.line.me/stickershop/product/30532466/" target="_blank" rel="noreferrer">
            <div class="utility-icon">
              <img src="/images/icon-donate.png" alt="" />
            </div>
            <span>贊助胖貓貓</span>
          </a>
          <a class="utility-item is-pending" href="./group-list.html" aria-disabled="true" tabindex="-1">
            <div class="utility-icon">
              <img src="/images/Registration list.png" alt="" />
            </div>
            <span>臨打名單</span>
          </a>
          <a class="utility-item is-pending" href="#" aria-disabled="true" tabindex="-1">
            <div class="utility-icon">
              <img src="/images/ball.png" alt="" />
            </div>
            <span>球隊公約</span>
          </a>
          <a class="utility-item is-pending" href="#" aria-disabled="true" tabindex="-1">
            <div class="utility-icon">
              <img src="/images/icon-album.png" alt="" />
            </div>
            <span>活動相簿</span>
          </a>
        </div>
      </section>

      <section class="section" aria-labelledby="faq-title">
        <h2 id="faq-title">常見問題</h2>
        <div class="faq-list">
          <article class="faq-item">
            <button class="faq-question" type="button" aria-expanded="false">
              <span>每週臨打的報名時間是什麼時候？</span>
              <i class="faq-arrow" aria-hidden="true"></i>
            </button>
            <div class="faq-answer">一般可在每週公告貼文發布後開始報名。正式上線後可把這段替換成實際規則或表單開放時間。</div>
          </article>
          <article class="faq-item">
            <button class="faq-question" type="button" aria-expanded="false">
              <span>這個群組的分級強度為何？</span>
              <i class="faq-arrow" aria-hidden="true"></i>
            </button>
            <div class="faq-answer">這裡先放示意文字。之後可以改成你的實際球隊分級、強度描述與參加建議。</div>
          </article>
          <article class="faq-item">
            <button class="faq-question" type="button" aria-expanded="false">
              <span>我可以幫非群內的朋友報名嗎？</span>
              <i class="faq-arrow" aria-hidden="true"></i>
            </button>
            <div class="faq-answer">可以把這裡改成報名政策，例如是否允許代報、是否需要先加入群組、是否要補填聯絡資訊。</div>
          </article>
          <article class="faq-item">
            <button class="faq-question" type="button" aria-expanded="false">
              <span>如果加入群組後都沒出現會被踢出嗎？</span>
              <i class="faq-arrow" aria-hidden="true"></i>
            </button>
            <div class="faq-answer">這一段目前是佔位內容。你之後可以直接把實際管理規則補進來，不用重寫整頁。</div>
          </article>
          <article class="faq-item">
            <button class="faq-question" type="button" aria-expanded="false">
              <span>這個群組的分級強度為何？</span>
              <i class="faq-arrow" aria-hidden="true"></i>
            </button>
            <div class="faq-answer">如果這題與上方重複，後續可以改成其他常見提問，或保留作為不同情境的補充說明。</div>
          </article>
          <article class="faq-item">
            <button class="faq-question" type="button" aria-expanded="false">
              <span>我可以幫非群內的朋友報名嗎？</span>
              <i class="faq-arrow" aria-hidden="true"></i>
            </button>
            <div class="faq-answer">這裡也先保留與設計稿一致的視覺結構，方便你之後換成正式問答內容。</div>
          </article>
        </div>
      </section>
      <div class="app-version" id="app-version">v--</div>
    </section>
  </div>
</template>

<style scoped>
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
.utility-item.is-pending {
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

@media (max-width: 500px) {
  .phone-scroll {
    overflow-y: auto;
  }

  .app-version {
    margin: 20px 0 12px;
  }
}
</style>
