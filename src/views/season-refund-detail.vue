<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getActivity } from '~/services/activityService'
import { listSeasonRegistrations } from '~/services/registrationService'

const route = useRoute()
const activityId = Number(route.params.id)

const activity = ref(null)
const registrations = ref([])
const isLoading = ref(true)

const membersWithLeave = computed(() => {
  if (!activity.value) return []

  const feePerSession =
    activity.value.season_fee_per_session ??
    activity.value.season_half_year_fee_per_session ??
    0

  return registrations.value
    .map(reg => {
      const leaveDates = Array.isArray(reg.leave_dates) ? reg.leave_dates : []
      const leaveCount = leaveDates.length

      let fee = feePerSession
      if (reg.season_plan === 'half-year' && activity.value.season_half_year_fee_per_session != null) {
        fee = activity.value.season_half_year_fee_per_session
      } else if (activity.value.season_fee_per_session != null) {
        fee = activity.value.season_fee_per_session
      }

      const refundAmount = leaveCount * fee

      const sortedDates = leaveDates.slice().sort()
      const formattedDates = sortedDates.map(d => {
        const [, m, day] = d.split('-')
        return `${Number(m)}/${Number(day)}`
      })

      return {
        userId: reg.user_id,
        displayName: reg.display_name || '—',
        leaveCount,
        refundAmount,
        formattedDates,
        seasonPlan: reg.season_plan,
      }
    })
    .filter(m => m.leaveCount > 0)
    .sort((a, b) => b.refundAmount - a.refundAmount)
})

const totalRefund = computed(() =>
  membersWithLeave.value.reduce((sum, m) => sum + m.refundAmount, 0)
)

function avatarChar(name) {
  return name ? name.charAt(0) : '?'
}

onMounted(async () => {
  const [act, regs] = await Promise.all([
    getActivity(activityId),
    listSeasonRegistrations(activityId),
  ])
  activity.value = act
  registrations.value = regs
  isLoading.value = false
})
</script>

<template>
  <main class="refund-detail-page">
    <div class="page-header">
      <h1 class="page-title">{{ activity?.title || '季打退費' }}</h1>
    </div>

    <template v-if="!isLoading">
      <div class="summary-bar">
        <div class="stat-label">應退總額</div>
        <div class="stat-value">${{ totalRefund.toLocaleString() }}</div>
      </div>

      <div v-if="membersWithLeave.length > 0" class="member-list">
        <div v-for="m in membersWithLeave" :key="m.userId" class="member-row">
          <div class="m-avatar">{{ avatarChar(m.displayName) }}</div>
          <div class="m-info">
            <div class="m-name">{{ m.displayName }}</div>
            <div class="m-dates">
              <span v-if="m.formattedDates.length > 0">請假：{{ m.formattedDates.join('、') }}</span>
            </div>
          </div>
          <div class="m-right">
            <div class="leave-count">{{ m.leaveCount }} 次</div>
            <div class="refund-amt">${{ m.refundAmount.toLocaleString() }}</div>
          </div>
        </div>
      </div>
      <p v-else class="empty-hint">本季目前沒有成員請假</p>
    </template>

    <p v-if="isLoading" class="loading-hint">載入中…</p>
  </main>
</template>

<style scoped>
.refund-detail-page {
  background: var(--surface);
  min-height: 100%;
  padding: 31px 16px 40px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.36;
  letter-spacing: 0.48px;
  font-weight: 700;
  color: var(--text);
}

.summary-bar {
  background: rgba(248, 222, 183, 0.18);
  border: 1px solid rgba(217, 141, 53, 0.2);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 24px;
}

.stat-label {
  font-size: 13px;
  color: #c79051;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #c79051;
  letter-spacing: 0.5px;
}

.member-list {
  display: grid;
  gap: 0;
}

.member-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-subtle, rgba(16, 24, 64, 0.06));
}

.member-row:last-child {
  border-bottom: none;
}

.m-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #a8b1f4;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}

.m-info {
  flex: 1;
  min-width: 0;
}

.m-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 4px;
}

.m-dates {
  font-size: 12px;
  color: var(--muted-soft, #8f95b2);
  line-height: 1.6;
  word-break: break-all;
}

.m-right {
  text-align: right;
  flex-shrink: 0;
}

.leave-count {
  font-size: 12px;
  color: var(--muted-soft, #8f95b2);
  margin-bottom: 2px;
}

.refund-amt {
  font-size: 15px;
  font-weight: 600;
  color: #c79051;
}

.empty-hint,
.loading-hint {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted-soft);
}
</style>
