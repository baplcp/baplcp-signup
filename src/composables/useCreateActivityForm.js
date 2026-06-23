export function createActivityFormDefaults() {
  return {
    gameType: 'season',
    activityTitle: '',
    pickupLabel: '',
    location: '',
    activityStartTime: '',
    activityEndTime: '',
    seasonSingleFee: '',
    halfYearSingleFee: '',
    pickupSingleFee: '',
    acFee: '',
    singleCapacity: '18',
    seasonIncludeAc: true,
    seasonCapacity: 'unlimited',
    seasonOpenDate: '',
    seasonOpenTime: '00:00',
    seasonDeadlineType: 'unlimited',
    seasonCloseDate: '',
    seasonCloseTime: '',
    pickupOpenDate: '前 7 天',
    pickupOpenTime: '20:00',
    deadlineType: 'unlimited',
    pickupCloseDate: '前 1 天',
    pickupCloseTime: '20:00',
    reminderEnabled: 'disabled',
    reminderDaysBefore: '前 3 天',
    reminderTime: '09:00',
  }
}

export function populateActivityForm(form, activity, selectedDates, seasonEnabled) {
  form.gameType = activity.game_type || 'season'
  form.activityTitle = activity.title || ''
  form.location = activity.location || ''
  selectedDates.value = activity.dates || []
  form.activityStartTime = activity.start_time || ''
  form.activityEndTime = activity.end_time || ''
  form.seasonSingleFee = String(activity.season_fee_per_session ?? '')
  form.halfYearSingleFee = String(activity.season_half_year_fee_per_session ?? '')
  form.pickupSingleFee = String(activity.pickup_fee_per_session ?? '')
  form.acFee = String(activity.ac_fee ?? '')
  form.singleCapacity = String(activity.single_capacity ?? '18')
  seasonEnabled.value = activity.season_enabled ?? true
  form.seasonIncludeAc = activity.season_include_ac ?? true
  form.seasonCapacity = activity.season_capacity || 'unlimited'
  form.seasonOpenDate = activity.season_open_date || ''
  form.seasonOpenTime = activity.season_open_time || '00:00'
  form.seasonDeadlineType = activity.season_deadline_type || 'unlimited'
  form.seasonCloseDate = activity.season_close_date || ''
  form.seasonCloseTime = activity.season_close_time || ''
  form.pickupLabel = activity.pickup_label || ''
  form.pickupOpenDate = activity.pickup_open_days_before ? `前 ${activity.pickup_open_days_before} 天` : '前 7 天'
  form.pickupOpenTime = activity.pickup_open_time || '20:00'
  form.deadlineType = activity.pickup_deadline_type || 'unlimited'
  form.pickupCloseDate = activity.pickup_close_days_before ? `前 ${activity.pickup_close_days_before} 天` : '前 1 天'
  form.pickupCloseTime = activity.pickup_close_time || ''
  form.reminderEnabled = activity.reminder_enabled ? 'enabled' : 'disabled'
  form.reminderDaysBefore = activity.reminder_days_before != null ? `前 ${activity.reminder_days_before} 天` : '前 3 天'
  form.reminderTime = activity.reminder_time ? activity.reminder_time.slice(0, 5) : '09:00'
}

function parseDaysBefore(raw) {
  const match = (raw || '').match(/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

export function getActivityFormErrors(form, selectedDates, seasonEnabled) {
  const checks = [
    { field: 'activityTitle', ok: form.activityTitle.trim() !== '' },
    { field: 'location', ok: form.location.trim() !== '' },
    { field: 'activityDates', ok: selectedDates.value.length > 0 },
    { field: 'activityStartTime', ok: form.activityStartTime !== '' },
    { field: 'activityEndTime', ok: form.activityEndTime !== '' },
    { field: 'seasonSingleFee', ok: String(form.seasonSingleFee).trim() !== '' },
    { field: 'halfYearSingleFee', ok: String(form.halfYearSingleFee).trim() !== '' },
    { field: 'pickupSingleFee', ok: String(form.pickupSingleFee).trim() !== '' },
    { field: 'acFee', ok: String(form.acFee).trim() !== '' },
    { field: 'singleCapacity', ok: String(form.singleCapacity).trim() !== '' },
    { field: 'pickupOpenDate', ok: form.pickupOpenDate !== '' },
    { field: 'pickupOpenTime', ok: form.pickupOpenTime !== '' },
  ]

  if (seasonEnabled.value) {
    checks.push({ field: 'seasonCapacity', ok: form.seasonCapacity !== '' }, { field: 'seasonOpenDate', ok: form.seasonOpenDate !== '' }, { field: 'seasonOpenTime', ok: form.seasonOpenTime !== '' })

    if (form.seasonDeadlineType === 'custom') {
      checks.push({ field: 'seasonCloseDate', ok: form.seasonCloseDate !== '' }, { field: 'seasonCloseTime', ok: form.seasonCloseTime !== '' })
    }
  }

  if (form.deadlineType === 'custom') {
    checks.push({ field: 'pickupCloseDate', ok: form.pickupCloseDate !== '' }, { field: 'pickupCloseTime', ok: form.pickupCloseTime !== '' })
  }

  if (form.reminderEnabled === 'enabled') {
    checks.push({ field: 'reminderDaysBefore', ok: form.reminderDaysBefore !== '' }, { field: 'reminderTime', ok: form.reminderTime !== '' })
  }

  return new Set(checks.filter(({ ok }) => !ok).map(({ field }) => field))
}

export function buildActivityPayload(form, selectedDates, seasonEnabled, seasonFee, halfYearFee) {
  return {
    game_type: form.gameType || 'season',
    title: form.activityTitle || '',
    location: form.location || '',
    dates: selectedDates.value,
    start_time: form.activityStartTime || null,
    end_time: form.activityEndTime || null,
    season_fee_per_session: Number(form.seasonSingleFee) || 0,
    season_half_year_fee_per_session: Number(form.halfYearSingleFee) || 0,
    pickup_fee_per_session: Number(form.pickupSingleFee) || 0,
    ac_fee: Number(form.acFee) || 0,
    single_capacity: Number(form.singleCapacity) || 18,
    season_enabled: seasonEnabled.value,
    season_include_ac: form.seasonIncludeAc,
    season_total_fee: Number(seasonFee) || 0,
    season_half_year_total_fee: Number(halfYearFee) || 0,
    season_capacity: form.seasonCapacity || null,
    season_open_date: form.seasonOpenDate || null,
    season_open_time: form.seasonOpenTime || null,
    season_deadline_type: form.seasonDeadlineType || 'unlimited',
    season_close_date: form.seasonCloseDate || null,
    season_close_time: form.seasonCloseTime || null,
    pickup_label: form.pickupLabel.trim() || null,
    pickup_open_days_before: parseDaysBefore(form.pickupOpenDate),
    pickup_open_time: form.pickupOpenTime || null,
    pickup_deadline_type: form.deadlineType || 'unlimited',
    pickup_close_days_before: parseDaysBefore(form.pickupCloseDate),
    pickup_close_time: form.pickupCloseTime || null,
    reminder_enabled: form.reminderEnabled === 'enabled',
    reminder_days_before: form.reminderEnabled === 'enabled' ? parseDaysBefore(form.reminderDaysBefore) : null,
    reminder_time: form.reminderEnabled === 'enabled' ? form.reminderTime : null,
  }
}
