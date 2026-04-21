<script setup>
import { APP_VERSION } from '~/assets/appVersion'
import HomeFaqList from '~/components/HomeFaqList.vue'
import HomeHero from '~/components/HomeHero.vue'
import HomeInfoCard from '~/components/HomeInfoCard.vue'
import HomeUtilityItem from '~/components/HomeUtilityItem.vue'

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

const infoCards = [
  {
    title: '球局列表',
    subtitle: '各週人員名單',
    imageSrc: import.meta.env.BASE_URL + '/images/card-party.png',
    to: '/group-list',
  },
  {
    title: '我的紀錄',
    subtitle: '報名與請假',
    imageSrc: import.meta.env.BASE_URL + '/images/card-calendar.png',
    pending: true,
  },
]

const utilityItems = [
  {
    label: '贊助胖貓貓',
    imageSrc: import.meta.env.BASE_URL + 'images/icon-donate.png',
    href: 'https://store.line.me/stickershop/product/30532466/',
    external: true,
    warm: true,
  },
  {
    label: '臨打名單',
    imageSrc: import.meta.env.BASE_URL + '/images/Registration list.png',
    to: '/group-list',
    pending: true,
  },
  {
    label: '球隊公約',
    imageSrc: import.meta.env.BASE_URL + '/images/ball.png',
    href: '#',
    pending: true,
  },
  {
    label: '活動相簿',
    imageSrc: import.meta.env.BASE_URL + '/images/icon-album.png',
    href: '#',
    pending: true,
  },
]
</script>

<template>
  <div class="index-page">
    <HomeHero title="球局報名區" subtitle="最新臨打報名及季打請假" cta-label="立即前往" cta-to="/active-activity" />

    <section class="content">
      <div class="top-cards">
        <HomeInfoCard v-for="card in infoCards" :key="card.title" :title="card.title" :subtitle="card.subtitle" :image-src="card.imageSrc" :to="card.to" :href="card.href" :pending="card.pending" />
      </div>

      <section class="section" aria-labelledby="utility-title">
        <h2 id="utility-title">常用功能</h2>
        <div class="utility-grid">
          <HomeUtilityItem
            v-for="item in utilityItems"
            :key="item.label"
            :label="item.label"
            :image-src="item.imageSrc"
            :to="item.to"
            :href="item.href"
            :warm="item.warm"
            :pending="item.pending"
            :external="item.external"
          />
        </div>
      </section>

      <section class="section" aria-labelledby="faq-title">
        <h2 id="faq-title">常見問題</h2>
        <HomeFaqList :faqs="faqs" />
      </section>
      <div class="app-version app-version-note">{{ APP_VERSION }}</div>
    </section>
  </div>
</template>

<style scoped>
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

.app-version {
  margin-top: 28px;
}
</style>
