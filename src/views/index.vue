<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  var APP_VERSION = 'v2026.04.15-03'
  var TARGET_PAGE = new URL('./active-activity.html', window.location.href).href
  var scrollContainer = document.querySelector('.phone-scroll')
  var nav = document.querySelector('.nav')
  var appVersion = document.getElementById('app-version')
  var heroCta = document.getElementById('hero-cta')

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

  if (heroCta) {
    heroCta.addEventListener('click', function () {
      window.location.href = TARGET_PAGE
    })
  }
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
          <button class="cta" id="hero-cta" type="button">立即前往</button>
        </div>
      </div>
    </section>

    <section class="content">
      <div class="top-cards">
        <RouterLink to="/active-activity" class="info-card">
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
