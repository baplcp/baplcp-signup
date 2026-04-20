<script setup>
import { ref } from 'vue'

const APP_VERSION = 'v2026.04.15-03'

const openFaqIndexes = ref([])

const faqs = [
  {
    question: '每週臨打的報名時間是什麼時候？',
    answer: '一般可在每週公告貼文發布後開始報名。正式上線後可把這段替換成實際規則或表單開放時間。',
  },
  {
    question: '這個群組的分級強度為何？',
    answer: '這裡先放示意文字。之後可以改成你的實際球隊分級、強度描述與參加建議。',
  },
  {
    question: '我可以幫非群內的朋友報名嗎？',
    answer: '可以把這裡改成報名政策，例如是否允許代報、是否需要先加入群組、是否要補填聯絡資訊。',
  },
  {
    question: '如果加入群組後都沒出現會被踢出嗎？',
    answer: '這一段目前是佔位內容。你之後可以直接把實際管理規則補進來，不用重寫整頁。',
  },
  {
    question: '這個群組的分級強度為何？',
    answer: '如果這題與上方重複，後續可以改成其他常見提問，或保留作為不同情境的補充說明。',
  },
  {
    question: '我可以幫非群內的朋友報名嗎？',
    answer: '這裡也先保留與設計稿一致的視覺結構，方便你之後換成正式問答內容。',
  },
]

function isFaqOpen(index) {
  return openFaqIndexes.value.includes(index)
}

function toggleFaq(index) {
  openFaqIndexes.value = isFaqOpen(index)
    ? openFaqIndexes.value.filter((openIndex) => openIndex !== index)
    : [...openFaqIndexes.value, index]
}
</script>

<template>
  <div class="index-page">
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
          <RouterLink to="/group-list" class="utility-item is-pending" aria-disabled="true" tabindex="-1">
            <div class="utility-icon">
              <img src="/images/Registration list.png" alt="" />
            </div>
            <span>臨打名單</span>
          </RouterLink>
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
          <article
            v-for="(faq, index) in faqs"
            :key="`${faq.question}-${index}`"
            class="faq-item"
            :class="{ 'is-open': isFaqOpen(index) }"
          >
            <button
              class="faq-question"
              type="button"
              :aria-expanded="String(isFaqOpen(index))"
              @click="toggleFaq(index)"
            >
              <span>{{ faq.question }}</span>
              <i class="faq-arrow" aria-hidden="true"></i>
            </button>
            <div class="faq-answer">{{ faq.answer }}</div>
          </article>
        </div>
      </section>
      <div class="app-version">{{ APP_VERSION }}</div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 274px;
  padding: 44px 0 106px;
  background: linear-gradient(180deg, var(--primary-700) 0%, var(--primary-400) 100%);
  box-shadow: var(--shadow-primary-card);
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
  filter: drop-shadow(-8px 9px 22.9px rgba(16, 24, 67, 0.45));
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
  background: linear-gradient(180deg, var(--accent-100) 6.25%, var(--accent-300) 47.596%, var(--accent-500) 100%);
  color: var(--accent-700);
  font-size: 16px;
  font-weight: 500;
  box-shadow: 1px 7px 21.3px rgba(27, 17, 75, 0.45);
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
  background: linear-gradient(180deg, var(--primary-700) 0%, var(--primary-300) 100%);
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
  filter: drop-shadow(3.995px 3.995px 15.279px rgba(16, 24, 67, 0.45));
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
  filter: drop-shadow(3.995px 3.995px 15.279px rgba(87, 104, 255, 0.6));
}

.utility-item.warm .utility-icon img {
  width: 58px;
  height: 58px;
  filter: drop-shadow(3.995px 3.995px 15.279px rgba(148, 77, 27, 0.5));
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
