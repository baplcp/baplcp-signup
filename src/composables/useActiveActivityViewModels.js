import { computed, reactive } from 'vue'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function useActiveActivityViewModels({
  activityData,
  activityType,
  resolvedDate,
  signupOpen,
  acEnabled,
  acFeePerSession,
  nowTick,
  memberList,
  cancelledMemberList,
  leaveMemberList,
  myRegistration,
  mySeasonRegistration,
  activeSegment,
  isLoading,
  isSubmitting,
  adminMode,
  signupState,
}) {
  const pageClasses = computed(() => [{ 'signup-open': signupOpen.value }, `hero-${activityType.value}`])
  const showHeroCat = computed(() => activityType.value === 'latest' || activityType.value === 'season')
  const heroTitle = computed(() => {
    if (activityType.value === 'season') return activityData.value?.title || '季打報名'
    if (activityType.value === 'upcoming') return '即將到來的球局'
    if (activityType.value === 'ended') return '已結束的球局'
    return '最新球局報名'
  })

  const summaryDate = computed(() => {
    if (!resolvedDate.value) return '—'
    const [, month, day] = resolvedDate.value.split('-')
    return `${Number(month)}.${day}`
  })
  const summaryWeekday = computed(() => (resolvedDate.value ? WEEKDAYS[new Date(resolvedDate.value + 'T00:00:00').getDay()] : '—'))
  const summaryTime = computed(() => {
    if (!activityData.value) return '—'
    const fmt = time => (time || '').replace(/^0/, '').slice(0, 5)
    return `${fmt(activityData.value.start_time)}-${fmt(activityData.value.end_time)}`
  })
  const summaryLocation = computed(() => activityData.value?.location || '板橋柏吉倫排球場')
  const activitySessionCount = computed(() => activityData.value?.dates?.length ?? 0)
  const activityDates = computed(() => activityData.value?.dates || [])
  const summaryFeeAmount = computed(() => {
    if (!activityData.value) return 255
    if (activityType.value === 'season') return activityData.value.season_total_fee || 0
    const base = activityData.value.pickup_fee_per_session || activityData.value.season_fee_per_session || 0
    return acEnabled.value ? base + acFeePerSession.value : base
  })

  const registrationOpenAt = computed(() => {
    const activity = activityData.value
    if (!activity) return null
    if (activityType.value === 'season') {
      if (!activity.season_open_date || !activity.season_open_time) return null
      const [year, month, day] = activity.season_open_date.split('-').map(Number)
      const [hour, minute] = activity.season_open_time.split(':').map(Number)
      return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0))
    }
    if (!resolvedDate.value || activity.pickup_open_days_before == null || !activity.pickup_open_time) return null
    const [year, month, day] = resolvedDate.value.split('-').map(Number)
    const [hour, minute] = activity.pickup_open_time.split(':').map(Number)
    return new Date(Date.UTC(year, month - 1, day - activity.pickup_open_days_before, hour - 8, minute, 0))
  })

  const registrationCloseAt = computed(() => {
    const activity = activityData.value
    if (!activity || activityType.value !== 'season' || !activity.season_close_date || !activity.season_close_time) return null
    const [year, month, day] = activity.season_close_date.split('-').map(Number)
    const [hour, minute] = activity.season_close_time.split(':').map(Number)
    return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0))
  })

  const isSeasonRegistrationClosed = computed(() => (registrationCloseAt.value ? nowTick.value >= registrationCloseAt.value : false))
  const isSeasonLeaveMode = computed(() => activityType.value !== 'season' && !!mySeasonRegistration.value)
  const isRegistrationOpen = computed(() => (registrationOpenAt.value ? nowTick.value >= registrationOpenAt.value : true))
  const registrationCountdown = computed(() => {
    if (isRegistrationOpen.value || !registrationOpenAt.value) return null
    const diff = registrationOpenAt.value.getTime() - nowTick.value.getTime()
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} 後開放` : `${minutes}:${String(seconds).padStart(2, '0')} 後開放`
  })

  const vacancyCount = computed(() => {
    if (activityType.value === 'season') {
      const capacity = activityData.value?.season_capacity
      if (!capacity || capacity === 'unlimited') return '∞'
      return Math.max(0, Number(capacity) - memberList.value.filter(member => !member.status).length)
    }
    return Math.max(0, (activityData.value?.single_capacity ?? 0) - memberList.value.filter(member => !member.status).length)
  })

  const segmentTabs = computed(() => (activityType.value === 'season' ? ['全部'] : ['臨打', '季打', '報名成功']))
  const filteredMemberList = computed(() => {
    if (activeSegment.value === '臨打') return memberList.value.filter(member => !member.isSeason)
    if (activeSegment.value === '季打') return memberList.value.filter(member => member.isSeason)
    if (activeSegment.value === '報名成功') return memberList.value.filter(member => !member.status)
    return memberList.value
  })
  const hasVisibleSectionBelow = computed(() => {
    const showCancelled = cancelledMemberList.value.length > 0 && isRegistrationOpen.value && (activityType.value === 'season' || activeSegment.value === '臨打')
    const showLeave = leaveMemberList.value.length > 0 && activeSegment.value === '季打'
    return showCancelled || showLeave
  })
  const memberBottomSpacing = computed(() => {
    if (isLoading.value || filteredMemberList.value.length === 0) return 0
    return hasVisibleSectionBelow.value ? 0 : 100
  })
  const showCancelledMemberList = computed(() => cancelledMemberList.value.length > 0 && isRegistrationOpen.value && (activityType.value === 'season' || activeSegment.value === '臨打'))
  const cancelledMemberListLabel = computed(() => (activityType.value === 'season' ? '已取消季打' : '已取消報名'))
  const showLeaveMemberList = computed(() => leaveMemberList.value.length > 0 && activeSegment.value === '季打')

  const submittedTotal = computed(() => (myRegistration.value ? (myRegistration.value.self_count || 0) + (myRegistration.value.guest_count || 0) : 0))
  const hasSubmittedSignup = computed(() => {
    if (activityType.value === 'season') return submittedTotal.value > 0
    if (submittedTotal.value > 0) return true
    if (!isSeasonLeaveMode.value) return false
    return !(mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value)
  })
  const signupTotal = computed(() => signupState.self + signupState.guest)
  const summaryFee = computed(() => submittedTotal.value * summaryFeeAmount.value)
  const myFullyPaid = computed(() => {
    if (!hasSubmittedSignup.value || !myRegistration.value) return false
    const registration = myRegistration.value
    if ((registration.self_count || 0) > 0 && (!registration.paid_court || (acEnabled.value && !registration.paid_ac))) return false
    return (registration.guests || []).every(guest => guest.paid_court && (!acEnabled.value || guest.paid_ac))
  })
  const summaryStatusText = computed(() => {
    if (activityType.value === 'season') return submittedTotal.value > 0 ? `已報名 ${submittedTotal.value} 位` : '未報名'
    if (isSeasonLeaveMode.value && submittedTotal.value === 0) {
      return (mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value) ? '已請假' : '季打成員'
    }
    return hasSubmittedSignup.value ? `成功卡位 ${submittedTotal.value} 位` : '無報名'
  })
  const summaryFeeLabel = computed(() => {
    if (!hasSubmittedSignup.value) return `費用 ${summaryFeeAmount.value} 元`
    return `費用 ${summaryFee.value} 元，${myFullyPaid.value ? '已繳' : '未繳'}`
  })
  const summaryCardProps = computed(() => ({
    date: activityType.value === 'season' ? '' : summaryDate.value,
    weekday: activityType.value === 'season' ? '' : summaryWeekday.value,
    time: summaryTime.value,
    location: summaryLocation.value,
    sessionCount: activityType.value === 'season' ? activitySessionCount.value : 0,
    statusLabel: '狀態',
    statusValue: summaryStatusText.value,
    statusTone: hasSubmittedSignup.value ? 'success' : 'default',
    feeAmount: activityType.value === 'season' ? summaryFeeAmount.value : hasSubmittedSignup.value ? summaryFee.value : summaryFeeAmount.value,
    feeState: activityType.value !== 'season' && hasSubmittedSignup.value ? (myFullyPaid.value ? '已繳' : '未繳') : '',
    feeStateTone: hasSubmittedSignup.value && myFullyPaid.value ? 'success' : 'default',
    feeAriaLabel: summaryFeeLabel.value,
    vacancyLabel: activityType.value === 'season' ? '季打缺' : '臨打缺',
    vacancyValue: vacancyCount.value,
    vacancyTone: activityType.value === 'season' ? 'orange' : 'teal',
  }))

  const heroCtaText = computed(() => {
    if (activityType.value === 'season') {
      if (isSeasonRegistrationClosed.value && !hasSubmittedSignup.value) return '已截止報名'
      return submittedTotal.value > 0 ? '管理報名' : '我要報名'
    }
    return isSeasonLeaveMode.value || hasSubmittedSignup.value ? '管理報名' : '我要報名'
  })
  const showFooterCta = computed(() => activityType.value !== 'ended' && !adminMode.value)
  const ctaDisabled = computed(() => isSeasonRegistrationClosed.value && !hasSubmittedSignup.value)
  const ctaLabel = computed(() => (isSubmitting.value ? '處理中...' : heroCtaText.value))

  return {
    resolvedDate,
    registrationOpenAt,
    submittedTotal,
    signupTotal,
    hasSubmittedSignup,
    isSeasonRegistrationClosed,
    isSeasonLeaveMode,
    isRegistrationOpen,
    activity: reactive({
      activityData,
      pageClasses,
      showHeroCat,
      heroTitle,
      isLoading,
    }),
    summary: reactive({
      summaryDate,
      summaryWeekday,
      summaryTime,
      summaryLocation,
      activitySessionCount,
      activityDates,
      summaryFeeAmount,
      vacancyCount,
      hasSubmittedSignup,
      summaryFee,
      myFullyPaid,
      summaryStatusText,
      summaryFeeLabel,
      summaryCardProps,
      isSeasonRegistrationClosed,
    }),
    members: reactive({
      activeSegment,
      segmentTabs,
      filteredMemberList,
      memberBottomSpacing,
      cancelledMemberList,
      leaveMemberList,
      hasVisibleSectionBelow,
      showCancelledMemberList,
      cancelledMemberListLabel,
      showLeaveMemberList,
    }),
    signup: reactive({
      signupTotal,
      isRegistrationOpen,
      registrationCountdown,
      isSeasonLeaveMode,
      showFooterCta,
      ctaDisabled,
      ctaLabel,
    }),
  }
}
