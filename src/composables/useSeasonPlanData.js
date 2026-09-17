import { computed } from 'vue'

function monthRange(dates) {
  if (!dates.length) return ''
  const first = new Date(dates[0])
  const last = new Date(dates[dates.length - 1])
  const firstMonth = `${first.getMonth() + 1}月`
  const lastMonth = `${last.getMonth() + 1}月`
  return firstMonth === lastMonth ? firstMonth : `${first.getMonth() + 1}-${last.getMonth() + 1}月`
}

export function useSeasonPlanData(activityData) {
  return computed(() => {
    const dates = [...(activityData.value?.dates || [])].sort()
    if (!dates.length) return { quarterCount: 0, quarterDateRange: '', quarterTotal: 0, quarterFeePerSession: 0, halfYearCount: 0, halfYearDateRange: '', halfYearTotal: 0, halfYearFeePerSession: 0 }
    const first = new Date(dates[0])
    const cutoff = new Date(first.getFullYear(), first.getMonth() + 3, 1)
    const quarterDates = dates.filter(date => new Date(date) < cutoff)
    return {
      quarterCount: quarterDates.length,
      quarterDateRange: monthRange(quarterDates),
      quarterTotal: activityData.value?.season_total_fee || 0,
      quarterFeePerSession: activityData.value?.season_fee_per_session || 0,
      halfYearCount: dates.length,
      halfYearDateRange: monthRange(dates),
      halfYearTotal: activityData.value?.season_half_year_total_fee || 0,
      halfYearFeePerSession: activityData.value?.season_half_year_fee_per_session || 0,
    }
  })
}
