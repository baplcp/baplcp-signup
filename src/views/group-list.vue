<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  var segmentTabs = document.querySelectorAll('[data-segment]')
  var moreButtons = document.querySelectorAll('[data-target-segment]')
  var historyRows = document.querySelectorAll('.history-list .history-row')
  var segmentSections = {
    latest: [document.getElementById('latest-section'), document.querySelector('.active-card')],
    upcoming: [document.getElementById('upcoming-section'), document.querySelector('.upcoming-list')],
    ended: [document.getElementById('ended-section'), document.querySelector('.history-list')],
  }

  function setSegment(segment) {
    segmentTabs.forEach(function (tab) {
      tab.classList.toggle('is-active', tab.dataset.segment === segment)
    })

    Object.keys(segmentSections).forEach(function (key) {
      var shouldShow = segment === 'all' || segment === key

      segmentSections[key].forEach(function (node) {
        if (node) {
          node.hidden = !shouldShow
        }
      })
    })

    moreButtons.forEach(function (button) {
      button.hidden = segment !== 'all'
    })

    historyRows.forEach(function (row, index) {
      row.hidden = segment === 'all' && index > 2
    })
  }

  segmentTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      setSegment(tab.dataset.segment)
    })
  })

  moreButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setSegment(button.dataset.targetSegment)
    })
  })

  setSegment('all')
})
</script>

<template>
  <main class="group-list-page">
    <section class="page">
      <h1 class="page-title">已發起的球局</h1>

      <nav class="segment-tabs" aria-label="球局分類">
        <button class="segment-tab is-active" type="button" data-segment="all">全部</button>
        <button class="segment-tab" type="button" data-segment="latest">最新球局</button>
        <button class="segment-tab" type="button" data-segment="upcoming">即將到來</button>
        <button class="segment-tab" type="button" data-segment="ended">已結束</button>
      </nav>

      <h2 class="section-title" id="latest-section">最新球局</h2>
      <article class="active-card">
        <div class="active-count" aria-label="臨打缺 9 人">
          <span class="active-count-label">臨打缺</span>
          <span class="active-count-value">9</span>
        </div>
        <div class="event-content">
          <p class="event-date">4.09 (日)<span class="divider">｜</span>8:00-11:00</p>
          <p class="event-location">板橋柏吉倫排球場</p>
        </div>
        <RouterLink to="/active-activity" class="go-button">前往</RouterLink>
      </article>

      <div class="section-heading" id="upcoming-section">
        <h2 class="section-title">即將到來</h2>
        <button class="more-button" type="button" data-target-segment="upcoming">更多</button>
      </div>
      <div class="upcoming-list" aria-label="即將到來">
        <RouterLink class="history-row" to="/active-activity">
          <div class="event-content">
            <p class="event-date">4.16 (日)<span class="divider">｜</span>12:20-15:20</p>
            <p class="event-location">板橋柏吉倫排球場</p>
          </div>
          <span class="badge badge-muted">未開放報名</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>

        <RouterLink class="history-row" to="/active-activity">
          <div class="event-content">
            <p class="event-date">4.23 (日)<span class="divider">｜</span>12:20-15:20</p>
            <p class="event-location">板橋柏吉倫排球場</p>
          </div>
          <span class="badge badge-muted">未開放報名</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>

        <RouterLink class="history-row" to="/active-activity">
          <div class="event-content">
            <p class="event-date">4.30 (日)<span class="divider">｜</span>12:20-15:20</p>
            <p class="event-location">板橋柏吉倫排球場</p>
          </div>
          <span class="badge badge-muted">未開放報名</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>
      </div>

      <div class="section-heading history-title" id="ended-section">
        <h2 class="section-title">已結束</h2>
        <button class="more-button" type="button" data-target-segment="ended">更多</button>
      </div>
      <div class="history-list" aria-label="已結束">
        <RouterLink class="history-row" to="/ended-activity">
          <div class="event-content">
            <p class="event-date">4.02 (日)</p>
            <p class="event-location">板橋柏吉倫排球場</p>
          </div>
          <span class="badge badge-success">已參加</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>

        <RouterLink class="history-row" to="/ended-activity">
          <div class="event-content">
            <p class="event-date">3.28 (日)</p>
            <p class="event-location">板橋柏吉倫排球場</p>
          </div>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>

        <RouterLink class="history-row" to="/ended-activity">
          <div class="event-content">
            <p class="event-date">3.21 (日)</p>
            <p class="event-location">板橋柏吉倫排球場</p>
          </div>
          <span class="badge badge-muted">已請假</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>

        <RouterLink class="history-row" to="/ended-activity">
          <div class="event-content">
            <p class="event-date">3.14 (日)</p>
            <p class="event-location">板橋柏吉倫排球場</p>
          </div>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>

        <RouterLink class="history-row" to="/ended-activity">
          <div class="event-content">
            <p class="event-date">3.07(日)</p>
            <p class="event-location">板橋柏吉倫排球場</p>
          </div>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
[hidden] {
  display: none !important;
}

.group-list-page {
  background: var(--surface);
  height: 100%;
}

.page {
  padding: 31px 16px 0;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.36;
  letter-spacing: 0.48px;
  font-weight: 700;
  color: var(--text);
}

.segment-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: end;
  margin: 20px 0 0;
  border-bottom: 1px solid rgba(237, 239, 245, 0.9);
}

.segment-tab {
  position: relative;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px 11px;
  color: var(--muted-soft);
  font-size: 14px;
  line-height: 1.4;
  font-weight: 400;
  white-space: nowrap;
}

.segment-tab.is-active {
  color: var(--text);
  font-weight: 600;
}

.segment-tab.is-active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  border-radius: 999px;
  background: var(--primary-700);
}

.section-title {
  margin: 28px 0 12px;
  font-size: 18px;
  line-height: 1.36;
  letter-spacing: 0.36px;
  font-weight: 700;
  color: var(--text);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 28px 0 12px;
}

.section-heading .section-title {
  margin: 0;
}

.more-button {
  color: var(--primary-700);
  font-size: 14px;
  line-height: 1.4;
  font-weight: 400;
  white-space: nowrap;
}

.active-card {
  min-height: 92px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(239, 241, 254, 0.8);
}

.active-count {
  width: 64px;
  height: 68px;
  border-radius: 9px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.active-count-label {
  font-size: 12px;
  line-height: 1.25;
  font-weight: 500;
  color: var(--muted);
}

.active-count-value {
  margin-top: 1px;
  font-size: 32px;
  line-height: 1.25;
  font-weight: 500;
  color: var(--primary-700);
}

.event-content {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 8px;
}

.event-date {
  margin: 0;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 500;
  color: var(--primary-700);
  white-space: nowrap;
}

.event-date .divider {
  color: var(--muted-soft);
}

.event-location {
  margin: 0;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 400;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.active-card .event-location {
  font-size: 14px;
}

.go-button {
  min-width: 64px;
  min-height: 44px;
  border-radius: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 17px;
  background: var(--primary-700);
  color: #fff;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 600;
  flex: 0 0 auto;
}

.history-title {
  margin-top: 28px;
  margin-bottom: 12px;
}

.history-list {
  margin-top: 0;
}

.upcoming-list {
  display: grid;
  gap: 0;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}

.upcoming-list .history-row {
  padding: 16px 0 16px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-bottom: 12px;
}

.history-list .history-row {
  padding-left: 12px;
}

.upcoming-list .history-row .event-date,
.history-list .history-row .event-date {
  color: var(--text);
}

.history-row .event-location {
  color: var(--muted-soft);
  font-size: 14px;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 400;
  white-space: nowrap;
  flex: 0 0 auto;
}

.badge-success {
  background: var(--secondary-100);
  color: var(--secondary-600);
}

.badge-muted {
  background: var(--line);
  color: var(--muted-soft);
}

.chevron {
  width: 24px;
  height: 24px;
  color: #696f8c;
  flex: 0 0 auto;
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
    display: block;
    padding: 0;
    background: #fff;
  }

  .app-shell {
    width: 100%;
    height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
