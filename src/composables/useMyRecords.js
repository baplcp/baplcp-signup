import { computed, ref } from 'vue'
import { listMyRecordSources, PARTICIPATION_COUNT_START_DATE } from '~/services/registrationService'
import { useLiffStore } from '~/stores/liff'
import { SEASON_PLAN_HALF_YEAR, seasonPlanCoversDate } from '~/utils/seasonPlan'
import { getTaiwanDateString, getTaiwanWeekday, parseTaiwanDateTime } from '~/utils/taiwanDate'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const QUARTER_LABELS = ['1~3 月', '4~6 月', '7~9 月', '10~12 月']

function formatMonthDay(dateString) {
  const [, month, day] = dateString.split('-')
  return `${Number(month)}/${Number(day)}`
}

function formatDateWithWeekday(dateString) {
  return `${formatMonthDay(dateString)}（${WEEKDAY_LABELS[getTaiwanWeekday(dateString)]}）`
}

function quarterIndexOf(dateString) {
  return Math.floor((Number(dateString.split('-')[1]) - 1) / 3)
}

// 與首頁累積次數的 count_past_participations 相同：日期已過，或當天且已過結束時間才算出席。
function isPastSession(dateString, endTime, now) {
  const today = getTaiwanDateString(now)
  if (dateString < today) return true
  if (dateString > today || !endTime) return false
  return now > parseTaiwanDateTime(dateString, endTime)
}

function isPickupUnpaid(registration, activity) {
  const acRequired = Boolean(activity?.ac_enabled) && Number(activity?.ac_fee) > 0
  return !registration.paid_court || (acRequired && !registration.paid_ac)
}

// 半年方案的單場費用不同；一季與後季共用一季單場費用，與主揪退費頁的算法一致。
function seasonFeePerSession(registration, activity) {
  const fee = registration.season_plan === SEASON_PLAN_HALF_YEAR ? activity?.season_half_year_fee_per_session : activity?.season_fee_per_session
  return Number(fee) || 0
}

export function useMyRecords() {
  const liffStore = useLiffStore()
  const sources = ref(null)
  const isLoading = ref(true)
  const loadError = ref(false)

  const activitiesById = computed(() => new Map((sources.value?.activities || []).map(activity => [activity.id, activity])))
  const pickupDatesById = computed(() => new Map((sources.value?.pickupActivityDates || []).map(activityDate => [activityDate.id, activityDate])))
  const seasonDatesByActivityId = computed(() => {
    return (sources.value?.seasonActivityDates || []).reduce((datesByActivityId, activityDate) => {
      const dates = datesByActivityId.get(activityDate.activity_id) || []
      dates.push(activityDate)
      datesByActivityId.set(activityDate.activity_id, dates)
      return datesByActivityId
    }, new Map())
  })
  const seasonRegistrations = computed(() => (sources.value?.registrations || []).filter(registration => !registration.activity_date_id))

  const attendanceRecords = computed(() => {
    if (!sources.value) return []
    const now = new Date()
    const records = []
    const leaveKeys = new Set(sources.value.leaveDates.map(leave => `${leave.registrationId}:${leave.activityDate}`))

    sources.value.registrations.forEach(registration => {
      const activity = activitiesById.value.get(registration.activity_id)

      if (registration.activity_date_id) {
        const activityDate = pickupDatesById.value.get(registration.activity_date_id)
        if (!activityDate || activityDate.activity_date < PARTICIPATION_COUNT_START_DATE || !isPastSession(activityDate.activity_date, activity?.end_time, now)) return
        records.push({
          key: `pickup:${registration.id}`,
          date: activityDate.activity_date,
          activityId: registration.activity_id,
          activityDateId: activityDate.id,
          unpaid: isPickupUnpaid(registration, activity),
        })
        return
      }

      // 季打的繳費勾選是整季共用且預設未繳，無法代表單場狀態，因此季打場次不標示尚未繳費。
      const activityDates = seasonDatesByActivityId.value.get(registration.activity_id) || []
      const dates = activityDates.map(activityDate => activityDate.activity_date)
      activityDates.forEach(activityDate => {
        const date = activityDate.activity_date
        if (date < PARTICIPATION_COUNT_START_DATE || !isPastSession(date, activity?.end_time, now)) return
        if (!seasonPlanCoversDate(registration.season_plan, date, dates) || leaveKeys.has(`${registration.id}:${date}`)) return
        records.push({
          key: `season:${registration.id}:${activityDate.id}`,
          date,
          activityId: registration.activity_id,
          activityDateId: activityDate.id,
          unpaid: false,
        })
      })
    })

    return records
      .sort((a, b) => b.date.localeCompare(a.date) || b.activityDateId - a.activityDateId)
      .map(record => ({
        ...record,
        label: formatDateWithWeekday(record.date),
        to: { name: 'activity', params: { id: record.activityId, activityDateId: record.activityDateId }, query: { type: 'ended' } },
      }))
  })

  const refundGroups = computed(() => {
    if (!sources.value) return []

    return seasonRegistrations.value
      .map(registration => {
        const activity = activitiesById.value.get(registration.activity_id)
        const dates = (seasonDatesByActivityId.value.get(registration.activity_id) || []).map(activityDate => activityDate.activity_date)
        const feePerSession = seasonFeePerSession(registration, activity)
        // 只退方案涵蓋的場次，例如一季方案不會有後三個月的退費。
        const leaveDates = [
          ...new Set(
            sources.value.leaveDates
              .filter(leave => leave.registrationId === registration.id && seasonPlanCoversDate(registration.season_plan, leave.activityDate, dates))
              .map(leave => leave.activityDate)
          ),
        ].sort()

        const quarters = leaveDates.reduce((grouped, date) => {
          const year = date.slice(0, 4)
          const key = `${year}-${quarterIndexOf(date)}`
          const quarter = grouped.get(key) || { key, label: QUARTER_LABELS[quarterIndexOf(date)], dates: [] }
          quarter.dates.push(date)
          grouped.set(key, quarter)
          return grouped
        }, new Map())

        return {
          registrationId: registration.id,
          title: activity?.title || '季打',
          firstDate: dates[0] || '',
          quarters: [...quarters.values()].map(quarter => ({
            key: `${registration.id}:${quarter.key}`,
            label: quarter.label,
            leaveCount: quarter.dates.length,
            refundAmount: quarter.dates.length * feePerSession,
            formattedDates: quarter.dates.map(formatMonthDay),
          })),
        }
      })
      .sort((a, b) => b.firstDate.localeCompare(a.firstDate))
  })

  const hasSeasonRegistration = computed(() => seasonRegistrations.value.length > 0)
  const isLoginRequired = computed(() => liffStore.initialized && !liffStore.userId)

  async function loadMyRecords() {
    isLoading.value = true
    loadError.value = false
    try {
      await liffStore.initialize()
      sources.value = await listMyRecordSources(liffStore.userId)
    } catch (error) {
      console.warn('Unable to load my records', error)
      loadError.value = true
    } finally {
      isLoading.value = false
    }
  }

  return {
    attendanceRecords,
    refundGroups,
    hasSeasonRegistration,
    isLoginRequired,
    isLoading,
    loadError,
    loadMyRecords,
  }
}
