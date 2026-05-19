<script setup>
import { onMounted, ref } from 'vue'
import { APP_VERSION } from '~/assets/appVersion'
import HomeFaqList from '~/components/home/HomeFaqList.vue'
import HomeHero from '~/components/home/HomeHero.vue'
import HomeInfoCard from '~/components/home/HomeInfoCard.vue'
import HomeUtilityItem from '~/components/home/HomeUtilityItem.vue'
import { supabase } from '~/utils/supabase'

const latestActivityTo = ref('/group-list')

const now = new Date()

function isDateExpired(dateStr, endTime) {
  if (!endTime) {
    const todayStr = now.toISOString().split('T')[0]
    return dateStr < todayStr
  }
  const [hours, minutes] = endTime.split(':').map(Number)
  const end = new Date(dateStr + 'T00:00:00')
  end.setHours(hours + 1, minutes, 0, 0)
  return now > end
}

onMounted(async () => {
  const { data } = await supabase
    .from('activities')
    .select('id, dates, end_time')
    .order('created_at', { ascending: false })
    .limit(20)

  if (data && data.length > 0) {
    let nearestDate = null
    let nearestActivity = null

    for (const activity of data) {
      const sorted = (activity.dates || []).slice().sort()
      const candidate = sorted.find(d => !isDateExpired(d, activity.end_time))
      if (candidate && (!nearestDate || candidate < nearestDate)) {
        nearestDate = candidate
        nearestActivity = activity
      }
    }

    if (nearestDate && nearestActivity) {
      latestActivityTo.value = `/active-activity?id=${nearestActivity.id}&date=${nearestDate}&type=latest`
    }
  }
})

const faqs = [
  {
    question: '每週臨打報名時間是什麼時候？',
    answer: '每週日晚上 20:00。',
  },
  {
    question: '群組分級強度及期許為何？',
    answer: '參考排球程度分級表，約 C+~B+。發球過網率不得低於 70%，態度積極，會自主訓練增加強度及穩定性。',
  },
  {
    question: '我可以幫非群內的朋友報名嗎？',
    answer: '可以，但請球友協助評估群外朋友的實力，希望至少有 B 以上。每人最多可攜伴 2 位報名，超過 2 位可以請其他群內朋友幫忙報名。',
  },
  {
    question: '如果加入群組後沒出現會被踢出嗎？',
    answer: '會的！為維護社團的穩定參與風氣，若參與次數長期偏低，可能會被移出群組，請多多把握出席機會。',
  },
  {
    question: '這個群組的打球風氣為何？',
    answer: '本社團為友善球場，請以尊重、友善的方式與隊友溝通，避免過度苛責、謾罵或情緒性言語，並以積極正向的態度參與球局。若經提醒後仍持續違反規範，主揪將視情況斟酌移出群組。',
  },
  {
    question: '季打請假及取消報名的期限是什麼時候？',
    answer: '季打請假及取消報名請於週五晚上 23:59 前完成。若超過截止時間，請私訊主揪說明，由主揪協助手動取消；但若屆時已無法替補到人，報名費用須由本人自行吸收。',
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
    label: '季打報名',
    imageSrc: import.meta.env.BASE_URL + '/images/ball.png',
    to: '/season-list',
  },
  {
    label: '臨打名單',
    imageSrc: import.meta.env.BASE_URL + '/images/Registration list.png',
    to: '/group-list',
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
    <HomeHero title="球局報名區" subtitle="最新臨打報名及季打請假" cta-label="立即前往" :cta-to="latestActivityTo" />

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
