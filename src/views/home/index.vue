<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { APP_VERSION } from '~/assets/appVersion'
import HomeFaqList from '~/components/home/HomeFaqList.vue'
import HomeHero from '~/components/home/HomeHero.vue'
import HomeInfoCard from '~/components/home/HomeInfoCard.vue'
import HomeParticipationCard from '~/components/home/HomeParticipationCard.vue'
import HomeUtilityItem from '~/components/home/HomeUtilityItem.vue'
import { listHomeActivityCandidates } from '~/services/activityService'
import { countPastParticipations } from '~/services/registrationService'
import { useLiffStore } from '~/stores/liff'
import { getTaiwanDateString, parseTaiwanDateTime } from '~/utils/taiwanDate'

const showComingSoon = ref(false)
let comingSoonTimer = null

const liffStore = useLiffStore()
const latestActivityTo = ref({ name: 'activities' })
const participationCount = ref(0)
const participationLoading = ref(true)
const imagesBaseUrl = import.meta.env.BASE_URL + 'images/'

const now = new Date()

function isDateExpired(dateStr, endTime) {
  if (!endTime) {
    const todayStr = getTaiwanDateString(now)
    return dateStr < todayStr
  }
  const end = parseTaiwanDateTime(dateStr, endTime)
  end.setUTCHours(end.getUTCHours() + 1)
  return now > end
}

function handleMyRecordClick() {
  if (comingSoonTimer) clearTimeout(comingSoonTimer)
  showComingSoon.value = true
  comingSoonTimer = setTimeout(() => {
    showComingSoon.value = false
    comingSoonTimer = null
  }, 2500)
}

async function loadLatestActivity() {
  try {
    const activities = await listHomeActivityCandidates()
    let nearestActivityDate = null
    let nearestActivity = null

    for (const activity of activities) {
      const candidate = (activity.activityDates || []).find(activityDate => !isDateExpired(activityDate.activity_date, activity.end_time))
      if (candidate && (!nearestActivityDate || candidate.activity_date < nearestActivityDate.activity_date)) {
        nearestActivityDate = candidate
        nearestActivity = activity
      }
    }

    if (nearestActivityDate && nearestActivity) {
      latestActivityTo.value = {
        name: 'activity',
        params: { id: nearestActivity.id, activityDateId: nearestActivityDate.id },
        query: { type: 'latest' },
      }
    }
  } catch (error) {
    console.warn('Unable to load the latest activity', error)
  }
}

async function loadParticipationCount() {
  try {
    await liffStore.initialize()
    participationCount.value = await countPastParticipations(liffStore.userId)
  } catch (error) {
    console.warn('Unable to load participation count', error)
  } finally {
    participationLoading.value = false
  }
}

onMounted(() => {
  void loadLatestActivity()
  void loadParticipationCount()
})

onUnmounted(() => {
  if (comingSoonTimer) clearTimeout(comingSoonTimer)
})

const faqs = [
  {
    question: '每週臨打報名時間是什麼時候？',
    answer: '・每週日晚上 20:00 開搶。\n・排球胖貓貓會在開始報名前 5 分鐘，於群組發送報名連結\n・可預填報名資料，群外朋友的性別為必填。',
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
    answer: '・季打請假及取消報名請於週五晚上 23:59 前完成。若超過截止時間，請私訊主揪說明，由主揪協助手動取消；但若屆時已無法替補到人，報名費用須由本人自行吸收。\n・季打若已知未來有旅遊、返鄉等安排，可以儘早請假不需等到當週，可於首頁>球局列表>該日期>管理報名 進行請假-1，讓主揪及其他臨打能儘早掌握缺額狀況。',
  },
]

const infoCards = [
  {
    title: '球局列表',
    subtitle: '各週人員名單',
    imageSrc: imagesBaseUrl + 'card-party.png',
    to: { name: 'activities' },
  },
  {
    title: '我的紀錄',
    subtitle: '報名與請假',
    imageSrc: imagesBaseUrl + 'card-calendar.png',
    pending: true,
  },
]

const utilityItems = [
  {
    label: '球局列表',
    imageSrc: imagesBaseUrl + 'Registration list.png',
    to: { name: 'activities' },
  },
  {
    label: '季打報名',
    imageSrc: imagesBaseUrl + 'ball.png',
    to: { name: 'seasons' },
  },
  {
    label: '打球影片',
    imageSrc: imagesBaseUrl + 'icon-video.png',
    href: 'https://www.youtube.com/@okayder',
    external: true,
  },
  {
    label: '贊助胖貓貓',
    imageSrc: imagesBaseUrl + 'icon-donate.png',
    href: 'https://store.line.me/stickershop/product/30532466/',
    external: true,
    warm: true,
  },
]
</script>

<template>
  <div class="index-page">
    <HomeHero title="球局報名區" subtitle="最新臨打報名及季打請假" cta-label="立即前往" :cta-to="latestActivityTo" />

    <section class="content">
      <div class="top-cards">
        <HomeInfoCard title="我的紀錄" subtitle="報名與請假" :image-src="infoCards[1].imageSrc" @click="handleMyRecordClick" />
        <HomeParticipationCard :count="participationCount" :loading="participationLoading" />
      </div>

      <div class="section">
        <h2>常用功能</h2>
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
      </div>

      <section class="section faq-section" aria-labelledby="faq-title">
        <h2 id="faq-title">常見問題</h2>
        <HomeFaqList :faqs="faqs" />
      </section>
      <div class="app-version app-version-note">{{ APP_VERSION }}</div>
    </section>
  </div>

  <Transition name="snackbar">
    <div v-if="showComingSoon" class="snackbar">即將開放，敬請期待</div>
  </Transition>
</template>

<style scoped>
.content {
  position: relative;
  margin-top: -124px;
  background: var(--surface);
  border-radius: 20px 20px 0 0;
  padding: 20px 16px 40px;
  min-height: calc(100% - 251px);
  z-index: 1;
}

.top-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}

.section {
  margin-top: 28px;
}

.faq-section {
  margin-top: 36px;
}

.section h2 {
  margin: 0 0 12px;
  font-size: 20px;
  line-height: 1.4;
  font-weight: 600;
  color: #101840;
}

.utility-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.app-version {
  margin-top: 28px;
}

.snackbar {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(16, 24, 64, 0.85);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  padding: 10px 20px;
  border-radius: 20px;
  white-space: nowrap;
  z-index: 100;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.snackbar-sub {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.7;
}

.snackbar-enter-active,
.snackbar-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.snackbar-enter-from,
.snackbar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
