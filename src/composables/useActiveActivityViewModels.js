import { computed, reactive } from 'vue'
import { addTaiwanDays, formatTaiwanTime, getTaiwanDateString, getTaiwanWeekday, parseTaiwanDateTime } from '~/utils/taiwanDate'
import { useSeasonPlanData } from '~/composables/useSeasonPlanData'
import { normalizeSeasonPlan, SEASON_PLAN_HALF_YEAR, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_QUARTER, seasonPlanLabel, seasonPlansOverlap } from '~/utils/seasonPlan'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const SEASON_PLAN_ORDER = [SEASON_PLAN_QUARTER, SEASON_PLAN_LATE_QUARTER, SEASON_PLAN_HALF_YEAR]

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
  mySeasonRegistrations,
  activeSegment,
  isLoading,
  isSubmitting,
  adminMode,
  signupState,
  selectedSeasonPlan,
}) {
  const pageClasses = computed(() => [{ 'signup-open': signupOpen.value }, `hero-${activityType.value}`])
  const showHeroCat = computed(() => activityType.value === 'latest' || activityType.value === 'pickup' || activityType.value === 'season')
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
  const summaryWeekday = computed(() => (resolvedDate.value ? WEEKDAYS[getTaiwanWeekday(resolvedDate.value)] : '—'))
  const summaryTime = computed(() => {
    if (!activityData.value) return '—'
    return `${formatTaiwanTime(activityData.value.start_time)}-${formatTaiwanTime(activityData.value.end_time)}`
  })
  const summaryLocation = computed(() => activityData.value?.location || '板橋柏吉倫排球場')
  const activitySessionCount = computed(() => activityData.value?.dates?.length ?? 0)
  const activityDates = computed(() => activityData.value?.dates || [])

  const seasonPlans = useSeasonPlanData(activityData)
  const availableSeasonPlans = computed(() => (activityType.value === 'season' ? seasonPlans.value.filter(plan => plan.available) : []))

  // 每個方案都看得到，不能選的標上原因，使用者才知道它存在、為什麼不能報：
  // 已經開打的方案報進去會付全額卻只剩幾場；後季是給球季中途加入的人，
  // 前半季開打前一律不開放，避免有人在新一季開放時就只卡後半季。
  // 已報名的方案不能重複報；範圍重疊的方案（例如已報一季再報半年）也不能並存，
  // 一季與後季不重疊，所以已報一季的人可以續報後季。
  const mySeasonPlans = computed(() => {
    if (activityType.value !== 'season') return []
    const plans = new Set((mySeasonRegistrations?.value || []).map(registration => normalizeSeasonPlan(registration.season_plan)))
    return SEASON_PLAN_ORDER.filter(plan => plans.has(plan))
  })
  const visibleSeasonPlans = computed(() => {
    const today = getTaiwanDateString(nowTick.value)
    const quarterStartDate = availableSeasonPlans.value.find(plan => plan.plan === SEASON_PLAN_QUARTER)?.firstDate
    const isLateQuarterOpen = !!quarterStartDate && quarterStartDate < today

    return availableSeasonPlans.value.map(plan => {
      const isRegistered = mySeasonPlans.value.includes(plan.plan)
      const overlapsRegistered = !isRegistered && mySeasonPlans.value.some(registeredPlan => seasonPlansOverlap(registeredPlan, plan.plan))
      const waitsForFirstHalf = plan.plan === SEASON_PLAN_LATE_QUARTER && !isLateQuarterOpen
      const notOpenYet = (plan.openAt && nowTick.value < plan.openAt) || waitsForFirstHalf
      // 已報名或與已報方案重疊的方案，對使用者來說都是不能再報，一律標示已截止。
      const unselectableReason =
        isRegistered || overlapsRegistered ? '已截止' : plan.closeAt && nowTick.value >= plan.closeAt ? '已截止' : plan.firstDate && plan.firstDate < today ? '已開打' : notOpenYet ? '尚未開放' : ''
      return { ...plan, isRegistered, unselectableReason, selectable: !unselectableReason }
    })
  })

  const selectableSeasonPlans = computed(() => visibleSeasonPlans.value.filter(plan => plan.selectable))

  const selectedSeasonPlanDetail = computed(() => {
    const candidates = selectableSeasonPlans.value.length ? selectableSeasonPlans.value : availableSeasonPlans.value
    return candidates.find(plan => plan.plan === selectedSeasonPlan?.value) || candidates[0] || null
  })

  const seasonQuarterSessionCount = computed(() => availableSeasonPlans.value.find(plan => plan.plan === SEASON_PLAN_QUARTER)?.count ?? 0)
  // 已報名時摘要卡顯示自己報的方案加總，例如一季 + 後季。
  const registeredSeasonPlanDetails = computed(() => availableSeasonPlans.value.filter(plan => mySeasonPlans.value.includes(plan.plan)))
  const seasonDisplaySessionCount = computed(() => {
    if (activityType.value !== 'season') return 0
    if (registeredSeasonPlanDetails.value.length) return registeredSeasonPlanDetails.value.reduce((sum, plan) => sum + plan.count, 0)
    return selectedSeasonPlanDetail.value?.count ?? 0
  })

  const summaryFeeAmount = computed(() => {
    if (!activityData.value) return 255
    if (activityType.value === 'season') {
      if (registeredSeasonPlanDetails.value.length) return registeredSeasonPlanDetails.value.reduce((sum, plan) => sum + plan.total, 0)
      return selectedSeasonPlanDetail.value?.total ?? 0
    }
    const base = activityData.value.pickup_fee_per_session || activityData.value.season_fee_per_session || 0
    return acEnabled.value ? base + acFeePerSession.value : base
  })

  const registrationOpenAt = computed(() => {
    const activity = activityData.value
    if (!activity) return null
    if (activityType.value === 'season') {
      if (selectableSeasonPlans.value.length) return null
      const pendingOpenTimes = availableSeasonPlans.value.map(plan => plan.openAt).filter(openAt => openAt && nowTick.value < openAt)
      return pendingOpenTimes.length ? new Date(Math.min(...pendingOpenTimes.map(openAt => openAt.getTime()))) : null
    }
    if (!resolvedDate.value || activity.pickup_open_days_before == null || !activity.pickup_open_time) return null
    return parseTaiwanDateTime(addTaiwanDays(resolvedDate.value, -activity.pickup_open_days_before), activity.pickup_open_time)
  })

  // 只有每個方案都截止才算季打報名結束。
  const registrationCloseAt = computed(() => {
    if (activityType.value !== 'season') return null
    const closeTimes = availableSeasonPlans.value.map(plan => plan.closeAt)
    if (!closeTimes.length || closeTimes.some(closeAt => !closeAt)) return null
    return new Date(Math.max(...closeTimes.map(closeAt => closeAt.getTime())))
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
    if (activeSegment.value === '臨打') return memberList.value.filter(member => !member.isSeason || member.isRejoined)
    if (activeSegment.value === '季打') return memberList.value.filter(member => member.isSeason)
    if (activeSegment.value === '報名成功') return memberList.value.filter(member => !member.status)
    return memberList.value
  })
  // 男女人數只算報名成功（正取）的人，不含候補；只在「報名成功」分頁顯示
  const genderCounts = computed(() => {
    const confirmedMembers = memberList.value.filter(member => !member.status)
    return {
      male: confirmedMembers.filter(member => member.gender === 'male').length,
      female: confirmedMembers.filter(member => member.gender === 'female').length,
    }
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

  const submittedTotal = computed(() => {
    if (!myRegistration.value) return 0
    return (myRegistration.value.is_self_registration && !myRegistration.value.cancelled_at ? 1 : 0) + (myRegistration.value.guests || []).filter(guest => !guest.cancelled_at).length
  })
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
    const acRequired = acEnabled.value && acFeePerSession.value > 0
    if (activityType.value === 'season') {
      return (mySeasonRegistrations?.value || []).every(registration => registration.paid_court && (!acRequired || registration.paid_ac))
    }
    const registration = myRegistration.value
    if (registration.is_self_registration && !registration.cancelled_at && (!registration.paid_court || (acRequired && !registration.paid_ac))) return false
    return (registration.guests || []).filter(guest => !guest.cancelled_at).every(guest => guest.paid_court && (!acRequired || guest.paid_ac))
  })
  const myWaitlistedCount = computed(() => {
    const myRegIds = new Set([myRegistration.value?.id, mySeasonRegistration.value?.id].filter(Boolean))
    if (!myRegIds.size) return 0
    return memberList.value.filter(member => myRegIds.has(member._regId) && member.status === '候補').length
  })

  const summaryStatusText = computed(() => {
    if (activityType.value === 'season') {
      if (submittedTotal.value > 0) {
        if (myFullyPaid.value) return `已報名${mySeasonPlans.value.length ? mySeasonPlans.value.map(seasonPlanLabel).join('、') : seasonPlanLabel(selectedSeasonPlan?.value)}`
        return '尚未繳費'
      }
      return '未報名'
    }
    if (isSeasonLeaveMode.value && submittedTotal.value === 0) {
      return (mySeasonRegistration.value?.leave_dates || []).includes(resolvedDate.value) ? '已請假' : '季打成員'
    }
    if (!hasSubmittedSignup.value) return '無報名'
    const waitlisted = myWaitlistedCount.value
    if (waitlisted <= 0) return `成功卡位 ${submittedTotal.value} 位`
    if (waitlisted >= submittedTotal.value) return `候補中 ${submittedTotal.value} 位`
    return `成功卡位 ${submittedTotal.value - waitlisted} 位／候補 ${waitlisted} 位`
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
    sessionCount: activityType.value === 'season' ? seasonDisplaySessionCount.value : 0,
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
    seasonPlanOptions: visibleSeasonPlans,
    selectableSeasonPlans,
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
      seasonQuarterSessionCount,
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
      genderCounts,
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
