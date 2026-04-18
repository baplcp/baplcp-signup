<script setup>
import { createClient } from '@supabase/supabase-js'
import { onMounted } from 'vue'

onMounted(() => {
  const SUPABASE_URL = 'https://rkmxoqopptyuqhbeswqo.supabase.co'
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbXhvcW9wcHR5dXFoYmVzd3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODU1NzMsImV4cCI6MjA5MjA2MTU3M30.r_Mows0iPF_FULtFJGCQctxERy8E5JCIndyD-llDbIA'
  const _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const api = {
    /* ── 活動 ───────────────────────────────────────────── */

    async getActivities() {
      // const { data, error } = await supabase.from('activities').select('*').order('date', { ascending: false });
      // if (error) throw error;
      // return data;
    },

    async getActivity(id) {
      // const { data, error } = await supabase.from('activities').select('*').eq('id', id).single();
      // if (error) throw error;
      // return data;
    },

    async createActivity(payload) {
      const { data, error } = await _client.from('activities').insert(payload).select().single()
      if (error) throw error
      return data
    },

    /* ── 報名 ───────────────────────────────────────────── */

    async getSignups(activityId) {
      // const { data, error } = await supabase.from('signups').select('*').eq('activity_id', activityId);
      // if (error) throw error;
      // return data;
    },

    async createSignup(payload) {
      // const { data, error } = await supabase.from('signups').insert(payload).select().single();
      // if (error) throw error;
      // return data;
    },

    async deleteSignup(id) {
      // const { error } = await supabase.from('signups').delete().eq('id', id);
      // if (error) throw error;
    },

    /* ── 使用者 ─────────────────────────────────────────── */

    async getCurrentUser() {
      // const { data: { user }, error } = await supabase.auth.getUser();
      // if (error) throw error;
      // return user;
    },
  }
  // ─── DOM refs ──────────────────────────────────────────────────────────────

  const els = {
    form: document.getElementById('create-activity-form'),
    cancelButton: document.getElementById('cancel-button'),
    seasonArea: document.getElementById('season-area'),
    seasonSwitch: document.getElementById('season-switch'),
    seasonFields: document.getElementById('season-fields'),
    seasonDisabledNote: document.getElementById('season-disabled-note'),
    dateButton: document.getElementById('date-picker-button'),
    dateFieldLabel: document.getElementById('date-field-label'),
    dateCountNote: document.getElementById('date-count-note'),
    dateInput: document.getElementById('activity-dates'),
    seasonOpenDateButton: document.getElementById('season-open-date-button'),
    seasonOpenDateInput: document.getElementById('season-open-date'),
    seasonCloseDateButton: document.getElementById('season-close-date-button'),
    seasonCloseDateInput: document.getElementById('season-close-date'),
    calendarOverlay: document.getElementById('calendar-overlay'),
    calendarTitle: document.getElementById('calendar-title'),
    calendarGrid: document.getElementById('calendar-grid'),
    calendarPrev: document.getElementById('calendar-prev'),
    calendarNext: document.getElementById('calendar-next'),
    calendarCancel: document.getElementById('calendar-cancel'),
    calendarDone: document.getElementById('calendar-done'),
    deadlineInput: document.getElementById('deadline-type'),
    deadlineButtons: document.querySelectorAll('[data-deadline-type]'),
    customDeadlineCard: document.querySelector('[data-deadline-type="custom"]'),
    seasonDeadlineInput: document.getElementById('season-deadline-type'),
    seasonDeadlineButtons: document.querySelectorAll('[data-season-deadline-type]'),
    customSeasonDeadlineCard: document.querySelector('[data-season-deadline-type="custom"]'),
    seasonCapacity: document.getElementById('season-capacity'),
    seasonSingleFee: document.getElementById('season-single-fee'),
    acFee: document.getElementById('ac-fee'),
    seasonFee: document.getElementById('season-fee'),
    seasonIncludeAc: document.getElementById('season-include-ac'),
    timeOverlay: document.getElementById('time-overlay'),
    timeClose: document.getElementById('time-close'),
    timeCancel: document.getElementById('time-cancel'),
    timeDone: document.getElementById('time-done'),
    timeHourWheel: document.getElementById('time-hour-wheel'),
    timeMinuteWheel: document.getElementById('time-minute-wheel'),
    timePeriodWheel: document.getElementById('time-period-wheel'),
    createDialogOverlay: document.getElementById('create-dialog-overlay'),
    createDialogTitle: document.getElementById('create-dialog-title'),
    createDialogCopy: document.getElementById('create-dialog-copy'),
    createDialogButton: document.getElementById('create-dialog-button'),
  }

  let shouldReturnAfterDialog = false

  // ─── Utilities ─────────────────────────────────────────────────────────────

  function formatDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
  }

  function formatDateLabel(value) {
    const parts = value.split('-')
    return `${Number(parts[1])}/${Number(parts[2])}`
  }

  function to24Hour(hour, minute, period) {
    let h = Number(hour)
    if (period === 'AM') h = h === 12 ? 0 : h
    else h = h === 12 ? 12 : h + 12
    return `${String(h).padStart(2, '0')}:${minute}`
  }

  function from24Hour(value) {
    if (!value) return { hour: '06', minute: '00', period: 'AM' }
    const parts = value.split(':')
    const h = Number(parts[0])
    return {
      hour: String(h % 12 || 12).padStart(2, '0'),
      minute: parts[1] || '00',
      period: h >= 12 ? 'PM' : 'AM',
    }
  }

  function syncSelectPlaceholder(select) {
    select.classList.toggle('is-placeholder', select.value === '')
  }

  function returnToPreviousPage() {
    if (window.history.length > 1) window.history.back()
    else window.location.href = './group-list.html'
  }

  function goToCreatedActivityList() {
    window.location.href = './group-list.html'
  }

  function setCreateDialogOpen(isOpen, options = {}) {
    if (!els.createDialogOverlay) return

    if (isOpen) {
      if (options.title) els.createDialogTitle.textContent = options.title
      if (options.copy) els.createDialogCopy.textContent = options.copy
      if (options.buttonText) els.createDialogButton.textContent = options.buttonText
      shouldReturnAfterDialog = Boolean(options.returnAfterClose)
    }

    els.createDialogOverlay.classList.toggle('is-open', isOpen)
    els.createDialogOverlay.setAttribute('aria-hidden', String(!isOpen))
    els.createDialogOverlay.inert = !isOpen

    const focusTarget = isOpen ? els.createDialogButton : document.querySelector('.submit-button')
    focusTarget?.focus({ preventScroll: true })
  }

  function closeCreateDialog() {
    const shouldReturn = shouldReturnAfterDialog
    shouldReturnAfterDialog = false
    setCreateDialogOpen(false)
    if (shouldReturn) goToCreatedActivityList()
  }

  // ─── TimePicker ────────────────────────────────────────────────────────────

  const TimePicker = {
    activeSelect: null,
    value: { hour: '06', minute: '00', period: 'AM' },
    scrollTimers: new WeakMap(),

    buildWheel(wheel, values, key) {
      wheel.innerHTML = ''
      values.forEach(v => {
        const btn = document.createElement('button')
        btn.className = 'time-wheel-option'
        btn.type = 'button'
        btn.dataset.value = v
        btn.textContent = v
        btn.addEventListener('click', () => {
          this.value[key] = v
          this.syncSelection()
          this.scrollToValue(wheel, v, 'smooth')
        })
        wheel.appendChild(btn)
      })

      wheel.addEventListener(
        'scroll',
        () => {
          clearTimeout(this.scrollTimers.get(wheel))
          this.scrollTimers.set(
            wheel,
            setTimeout(() => {
              const opt = this.getCenteredOption(wheel)
              if (!opt) return
              this.value[key] = opt.dataset.value
              this.syncSelection()
            }, 90)
          )
        },
        { passive: true }
      )
    },

    getCenteredOption(wheel) {
      const options = Array.from(wheel.querySelectorAll('.time-wheel-option'))
      const center = wheel.getBoundingClientRect().top + wheel.clientHeight / 2
      return options.reduce((closest, opt) => {
        const dist = Math.abs(opt.getBoundingClientRect().top + opt.offsetHeight / 2 - center)
        return !closest || dist < closest.dist ? { opt, dist } : closest
      }, null).opt
    },

    scrollToValue(wheel, value, behavior = 'auto') {
      const opt = wheel.querySelector(`[data-value="${value}"]`)
      if (!opt) return
      wheel.scrollTo({
        top: opt.offsetTop - (wheel.clientHeight - opt.offsetHeight) / 2,
        behavior,
      })
    },

    syncSelection() {
      ;[
        { wheel: els.timeHourWheel, key: 'hour' },
        { wheel: els.timeMinuteWheel, key: 'minute' },
        { wheel: els.timePeriodWheel, key: 'period' },
      ].forEach(({ wheel, key }) => {
        wheel.querySelectorAll('.time-wheel-option').forEach(opt => {
          opt.classList.toggle('is-selected', opt.dataset.value === this.value[key])
        })
      })
    },

    step(key, direction) {
      const wheels = {
        hour: els.timeHourWheel,
        minute: els.timeMinuteWheel,
        period: els.timePeriodWheel,
      }
      const wheel = wheels[key]
      if (!wheel) return
      const options = Array.from(wheel.querySelectorAll('.time-wheel-option'))
      let idx = options.findIndex(o => o.dataset.value === this.value[key]) + Number(direction)
      if (idx < 0) idx = options.length - 1
      if (idx >= options.length) idx = 0
      this.value[key] = options[idx].dataset.value
      this.syncSelection()
      this.scrollToValue(wheel, this.value[key], 'smooth')
    },

    setOpen(isOpen, select) {
      els.timeOverlay.classList.toggle('is-open', isOpen)
      els.timeOverlay.setAttribute('aria-hidden', String(!isOpen))
      if (!isOpen) {
        this.activeSelect = null
        return
      }

      this.activeSelect = select
      this.value = from24Hour(select.value)
      this.syncSelection()
      requestAnimationFrame(() => {
        this.scrollToValue(els.timeHourWheel, this.value.hour)
        this.scrollToValue(els.timeMinuteWheel, this.value.minute)
        this.scrollToValue(els.timePeriodWheel, this.value.period)
      })
    },

    commit() {
      if (!this.activeSelect) return
      const value = to24Hour(this.value.hour, this.value.minute, this.value.period)
      this.activeSelect.value = value
      syncSelectPlaceholder(this.activeSelect)
      this.activeSelect.dispatchEvent(new Event('change', { bubbles: true }))
      this.setOpen(false)
    },

    init() {
      const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
      const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
      this.buildWheel(els.timeHourWheel, hours, 'hour')
      this.buildWheel(els.timeMinuteWheel, minutes, 'minute')
      this.buildWheel(els.timePeriodWheel, ['AM', 'PM'], 'period')

      document.querySelectorAll('[data-time-wheel-step]').forEach(btn => {
        btn.addEventListener('click', () => this.step(btn.dataset.timeWheelStep, btn.dataset.direction))
      })

      document.querySelectorAll('[data-time-select]').forEach(select => {
        const wrapper = select.closest('.select-wrap')
        if (wrapper) wrapper.addEventListener('click', () => this.setOpen(true, select))
      })

      els.timeClose.addEventListener('click', () => this.commit())
      els.timeDone.addEventListener('click', () => this.commit())
      els.timeCancel.addEventListener('click', () => this.setOpen(false))
      els.timeOverlay.addEventListener('click', e => {
        if (e.target === els.timeOverlay) this.setOpen(false)
      })
    },
  }

  // ─── CalendarPicker ────────────────────────────────────────────────────────

  const CalendarPicker = {
    activeTarget: 'activity',
    selectedDates: [],
    seasonOpenDate: '',
    seasonCloseDate: '',
    visibleMonth: (() => {
      const d = new Date()
      d.setDate(1)
      return d
    })(),

    getSelectedValues() {
      if (this.activeTarget === 'season-open') return this.seasonOpenDate ? [this.seasonOpenDate] : []
      if (this.activeTarget === 'season-close') return this.seasonCloseDate ? [this.seasonCloseDate] : []
      return this.selectedDates
    },

    syncDateText() {
      els.dateInput.value = this.selectedDates.join(',')
      els.dateButton.classList.toggle('has-value', this.selectedDates.length > 0)
      if (this.selectedDates.length > 0) els.dateButton.classList.remove('is-error')
      els.dateButton.textContent = this.selectedDates.length ? this.selectedDates.map(formatDateLabel).join('、') : '請選擇日期'
      els.dateCountNote.hidden = this.selectedDates.length === 0
      els.dateCountNote.textContent = `共 ${this.selectedDates.length} 次`
      if (this.selectedDates.length > 0) {
        const earliest = new Date(this.selectedDates[0])
        earliest.setDate(earliest.getDate() - 30)
        this.seasonOpenDate = formatDate(earliest)
        this.syncSingleDateText('season-open')
      }

      Season.updateFee()
      Season.syncAvailability()
    },

    syncSingleDateText(target) {
      const isOpen = target === 'season-open'
      const value = isOpen ? this.seasonOpenDate : this.seasonCloseDate
      const button = isOpen ? els.seasonOpenDateButton : els.seasonCloseDateButton
      const input = isOpen ? els.seasonOpenDateInput : els.seasonCloseDateInput
      input.value = value
      button.classList.toggle('has-value', Boolean(value))
      if (value) button.classList.remove('is-error')
      button.textContent = value ? formatDateLabel(value) : '請選擇日期'
    },

    render() {
      const year = this.visibleMonth.getFullYear()
      const month = this.visibleMonth.getMonth()
      const startOffset = new Date(year, month, 1).getDay()
      const gridStart = new Date(year, month, 1 - startOffset)
      const selected = this.getSelectedValues()

      els.calendarTitle.textContent = `${year} 年 ${month + 1} 月`
      els.calendarGrid.innerHTML = ''

      for (let i = 0; i < 42; i++) {
        const date = new Date(gridStart)
        date.setDate(gridStart.getDate() + i)
        const value = formatDate(date)

        const btn = document.createElement('button')
        btn.className = 'calendar-day'
        btn.type = 'button'
        btn.textContent = String(date.getDate())
        btn.dataset.date = value
        if (date.getMonth() !== month) btn.classList.add('is-muted')
        if (selected.indexOf(value) !== -1) btn.classList.add('is-selected')

        btn.addEventListener('click', () => {
          if (this.activeTarget === 'season-open') {
            this.seasonOpenDate = value
            this.syncSingleDateText('season-open')
          } else if (this.activeTarget === 'season-close') {
            this.seasonCloseDate = value
            this.syncSingleDateText('season-close')
          } else {
            const idx = this.selectedDates.indexOf(value)
            if (idx === -1) this.selectedDates.push(value)
            else this.selectedDates.splice(idx, 1)
            this.selectedDates.sort()
            this.syncDateText()
          }
          this.render()
        })

        els.calendarGrid.appendChild(btn)
      }
    },

    setOpen(isOpen, target) {
      if (target) this.activeTarget = target
      els.calendarOverlay.classList.toggle('is-open', isOpen)
      els.calendarOverlay.setAttribute('aria-hidden', String(!isOpen))
      if (isOpen) this.render()
    },

    init() {
      els.dateButton.addEventListener('click', () => this.setOpen(true, 'activity'))
      els.seasonOpenDateButton.addEventListener('click', () => this.setOpen(true, 'season-open'))
      els.seasonCloseDateButton.addEventListener('click', () => this.setOpen(true, 'season-close'))
      els.calendarPrev.addEventListener('click', () => {
        this.visibleMonth.setMonth(this.visibleMonth.getMonth() - 1)
        this.render()
      })
      els.calendarNext.addEventListener('click', () => {
        this.visibleMonth.setMonth(this.visibleMonth.getMonth() + 1)
        this.render()
      })
      els.calendarCancel.addEventListener('click', () => this.setOpen(false))
      els.calendarDone.addEventListener('click', () => this.setOpen(false))
      els.calendarOverlay.addEventListener('click', e => {
        if (e.target === els.calendarOverlay) this.setOpen(false)
      })
    },
  }

  // ─── Choice Groups ─────────────────────────────────────────────────────────

  function syncChoiceGroup(input, buttons, customCard, type, dataKey) {
    input.value = type
    buttons.forEach(btn => {
      const isActive = btn.dataset[dataKey] === type
      btn.classList.toggle('is-active', isActive)
      btn.classList.toggle('is-condensed', type === 'unlimited')
      btn.setAttribute('aria-pressed', String(isActive))
    })
    if (customCard) customCard.classList.toggle('is-condensed', type === 'unlimited')
  }

  function bindChoiceGroup(input, buttons, customCard, dataKey) {
    buttons.forEach(btn => {
      btn.addEventListener('click', e => {
        if (e.target.tagName === 'SELECT') return
        syncChoiceGroup(input, buttons, customCard, btn.dataset[dataKey], dataKey)
      })
      btn.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        syncChoiceGroup(input, buttons, customCard, btn.dataset[dataKey], dataKey)
      })
    })
  }

  // ─── Season ────────────────────────────────────────────────────────────────

  const Season = {
    updateFee() {
      const base = Number(els.seasonSingleFee.value || 0)
      const ac = els.seasonIncludeAc.checked ? Number(els.acFee.value || 0) : 0
      const count = CalendarPicker.selectedDates.length
      els.seasonFee.value = count > 0 ? String((base + ac) * count) : ''
      els.seasonFee.style.setProperty('--season-fee-digits', String(Math.max(els.seasonFee.value.length, 1)))
    },

    setOpen(isOpen) {
      els.seasonSwitch.classList.toggle('is-on', isOpen)
      els.seasonSwitch.setAttribute('aria-checked', String(isOpen))
      els.seasonFields.classList.toggle('is-collapsed', !isOpen)
      els.seasonArea.classList.toggle('is-collapsed', !isOpen)
    },

    syncAvailability() {
      const below = CalendarPicker.selectedDates.length > 0 && CalendarPicker.selectedDates.length < 4
      els.seasonSwitch.setAttribute('aria-disabled', String(below))
      els.seasonSwitch.classList.toggle('is-disabled', below)
      els.seasonDisabledNote.hidden = !below
      els.seasonDisabledNote.classList.remove('is-alert')
      if (below) this.setOpen(false)
    },

    init() {
      els.seasonSwitch.addEventListener('click', () => {
        if (els.seasonSwitch.getAttribute('aria-disabled') === 'true') {
          els.seasonDisabledNote.classList.add('is-alert')
          return
        }
        this.setOpen(els.seasonSwitch.getAttribute('aria-checked') !== 'true')
      })
      ;[els.seasonSingleFee, els.acFee, els.seasonIncludeAc].forEach(field => {
        field.addEventListener('input', () => this.updateFee())
        field.addEventListener('change', () => this.updateFee())
      })
    },
  }

  // ─── Selects ───────────────────────────────────────────────────────────────

  function populateCapacityOptions() {
    const unlimited = document.createElement('option')
    unlimited.value = 'unlimited'
    unlimited.textContent = '不限'
    els.seasonCapacity.appendChild(unlimited)

    for (let n = 1; n <= 18; n++) {
      const opt = document.createElement('option')
      opt.value = opt.textContent = String(n)
      els.seasonCapacity.appendChild(opt)
    }
  }

  function populateTimeSelects() {
    document.querySelectorAll('[data-time-select]').forEach(select => {
      const placeholder = select.dataset.timePlaceholder || '請選擇時間'
      select.innerHTML = ''

      const ph = document.createElement('option')
      ph.value = ''
      ph.textContent = placeholder
      select.appendChild(ph)

      for (let m = 0; m < 24 * 60; m++) {
        const opt = document.createElement('option')
        opt.value = opt.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
        select.appendChild(opt)
      }
    })
  }

  function initSelectPlaceholders() {
    document.querySelectorAll('select').forEach(select => {
      syncSelectPlaceholder(select)
      select.addEventListener('change', () => syncSelectPlaceholder(select))
    })
  }

  // ─── Validation ────────────────────────────────────────────────────────────

  function validate() {
    const titleEl = document.getElementById('activity-title')
    const locationEl = document.getElementById('location')
    const startTimeEl = document.getElementById('activity-start-time')
    const endTimeEl = document.getElementById('activity-end-time')
    const seasonSingleFeeEl = document.getElementById('season-single-fee')
    const pickupSingleFeeEl = document.getElementById('pickup-single-fee')
    const singleCapacityEl = document.getElementById('single-capacity')
    const seasonOpenTimeEl = document.getElementById('season-open-time')
    const seasonCloseTimeEl = document.getElementById('season-close-time')
    const pickupOpenDateEl = document.getElementById('pickup-open-date')
    const pickupOpenTimeEl = document.getElementById('pickup-open-time')
    const pickupCloseDateEl = document.getElementById('pickup-close-date')
    const pickupCloseTimeEl = document.getElementById('pickup-close-time')

    // 費用欄位的 border 在 .money-input 父層，需對父層套用 is-error
    const errEl = el => el.closest('.money-input') || el

    const fields = [
      { target: titleEl, ok: titleEl.value.trim() !== '' },
      { target: locationEl, ok: locationEl.value.trim() !== '' },
      { target: els.dateButton, ok: CalendarPicker.selectedDates.length > 0 },
      { target: startTimeEl, ok: startTimeEl.value !== '' },
      { target: endTimeEl, ok: endTimeEl.value !== '' },
      { target: errEl(seasonSingleFeeEl), ok: seasonSingleFeeEl.value.trim() !== '' },
      { target: errEl(pickupSingleFeeEl), ok: pickupSingleFeeEl.value.trim() !== '' },
      { target: errEl(els.acFee), ok: els.acFee.value.trim() !== '' },
      { target: singleCapacityEl, ok: singleCapacityEl.value.trim() !== '' },
      { target: pickupOpenDateEl, ok: pickupOpenDateEl.value !== '' },
      { target: pickupOpenTimeEl, ok: pickupOpenTimeEl.value !== '' },
    ]

    if (els.seasonSwitch.getAttribute('aria-checked') === 'true') {
      fields.push(
        { target: els.seasonCapacity, ok: els.seasonCapacity.value !== '' },
        { target: els.seasonOpenDateButton, ok: CalendarPicker.seasonOpenDate !== '' },
        { target: seasonOpenTimeEl, ok: seasonOpenTimeEl.value !== '' }
      )
      if (els.seasonDeadlineInput.value === 'custom') {
        fields.push({ target: els.seasonCloseDateButton, ok: CalendarPicker.seasonCloseDate !== '' }, { target: seasonCloseTimeEl, ok: seasonCloseTimeEl.value !== '' })
      }
    }

    if (els.deadlineInput.value === 'custom') {
      fields.push({ target: pickupCloseDateEl, ok: pickupCloseDateEl.value !== '' }, { target: pickupCloseTimeEl, ok: pickupCloseTimeEl.value !== '' })
    }

    let firstError = null
    fields.forEach(({ target, ok }) => {
      target.classList.toggle('is-error', !ok)
      if (!ok && !firstError) firstError = target
    })

    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setCreateDialogOpen(true, {
        title: '報名尚未完成',
        copy: '有部分必填欄位尚未填寫，請確認標示的欄位後再送出。',
        buttonText: '確認',
        returnAfterClose: false,
      })
    }
    return !firstError
  }

  // ─── Form Submit ───────────────────────────────────────────────────────────

  function buildActivityPayload() {
    const fd = new FormData(els.form)
    const seasonEnabled = els.seasonSwitch.getAttribute('aria-checked') === 'true'
    const datesRaw = fd.get('activityDates') || ''
    const dates = datesRaw ? datesRaw.split(',') : []

    function parseDaysBefore(raw) {
      const m = (raw || '').match(/(\d+)/)
      return m ? parseInt(m[1], 10) : null
    }

    return {
      game_type: fd.get('gameType') || 'season',
      title: fd.get('activityTitle') || '',
      location: fd.get('location') || '',
      dates,
      start_time: fd.get('activityStartTime') || null,
      end_time: fd.get('activityEndTime') || null,
      season_fee_per_session: Number(fd.get('seasonSingleFee')) || 0,
      pickup_fee_per_session: Number(fd.get('pickupSingleFee')) || 0,
      ac_fee: Number(fd.get('acFee')) || 0,
      single_capacity: Number(fd.get('singleCapacity')) || 18,
      season_enabled: seasonEnabled,
      season_include_ac: fd.get('seasonIncludeAc') === 'on',
      season_total_fee: Number(fd.get('seasonFee')) || 0,
      season_capacity: fd.get('seasonCapacity') || null,
      season_open_date: fd.get('seasonOpenDate') || null,
      season_open_time: fd.get('seasonOpenTime') || null,
      season_deadline_type: fd.get('seasonDeadlineType') || 'unlimited',
      season_close_date: fd.get('seasonCloseDate') || null,
      season_close_time: fd.get('seasonCloseTime') || null,
      pickup_open_days_before: parseDaysBefore(fd.get('pickupOpenDate')),
      pickup_open_time: fd.get('pickupOpenTime') || null,
      pickup_deadline_type: fd.get('deadlineType') || 'unlimited',
      pickup_close_days_before: parseDaysBefore(fd.get('pickupCloseDate')),
      pickup_close_time: fd.get('pickupCloseTime') || null,
    }
  }

  async function handleCreateActivity(event) {
    event.preventDefault()
    if (!validate()) return

    const submitButton = document.querySelector('.submit-button')
    if (submitButton) {
      submitButton.disabled = true
      submitButton.textContent = '建立中…'
    }

    try {
      await api.createActivity(buildActivityPayload())
      setCreateDialogOpen(true, {
        title: '球局建立成功',
        copy: '新球局已建立完成。',
        buttonText: '確認',
        returnAfterClose: true,
      })
    } catch (err) {
      setCreateDialogOpen(true, {
        title: '建立失敗',
        copy: err.message || '請稍後再試',
        buttonText: '確認',
        returnAfterClose: false,
      })
    } finally {
      if (submitButton) {
        submitButton.disabled = false
        submitButton.textContent = '建立球局'
      }
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    populateCapacityOptions()
    populateTimeSelects()
    initSelectPlaceholders()
    TimePicker.init()
    CalendarPicker.init()
    Season.init()

    bindChoiceGroup(els.deadlineInput, els.deadlineButtons, els.customDeadlineCard, 'deadlineType')
    bindChoiceGroup(els.seasonDeadlineInput, els.seasonDeadlineButtons, els.customSeasonDeadlineCard, 'seasonDeadlineType')
    syncChoiceGroup(els.deadlineInput, els.deadlineButtons, els.customDeadlineCard, 'unlimited', 'deadlineType')
    syncChoiceGroup(els.seasonDeadlineInput, els.seasonDeadlineButtons, els.customSeasonDeadlineCard, 'unlimited', 'seasonDeadlineType')

    els.dateFieldLabel.textContent = '日期（多選）'
    els.seasonArea.hidden = false
    els.seasonCapacity.value = 'unlimited'
    syncSelectPlaceholder(els.seasonCapacity)

    const pickupOpenDateEl = document.getElementById('pickup-open-date')
    const pickupOpenTimeEl = document.getElementById('pickup-open-time')
    const seasonOpenTimeEl = document.getElementById('season-open-time')
    const pickupCloseDateEl = document.getElementById('pickup-close-date')
    const pickupCloseTimeEl = document.getElementById('pickup-close-time')
    pickupOpenDateEl.value = '前 7 天'
    pickupOpenTimeEl.value = '20:00'
    pickupCloseDateEl.value = '前 1 天'
    pickupCloseTimeEl.value = '20:00'
    seasonOpenTimeEl.value = '00:00'
    syncSelectPlaceholder(pickupOpenDateEl)
    syncSelectPlaceholder(pickupOpenTimeEl)
    syncSelectPlaceholder(pickupCloseDateEl)
    syncSelectPlaceholder(pickupCloseTimeEl)
    syncSelectPlaceholder(seasonOpenTimeEl)

    CalendarPicker.syncDateText()
    CalendarPicker.syncSingleDateText('season-open')
    CalendarPicker.syncSingleDateText('season-close')

    els.form.querySelectorAll('input, select').forEach(el => {
      const target = el.closest('.money-input') || el
      el.addEventListener('input', () => target.classList.remove('is-error'))
      el.addEventListener('change', () => target.classList.remove('is-error'))
    })

    els.cancelButton?.addEventListener('click', () => {
      returnToPreviousPage()
    })

    els.createDialogButton?.addEventListener('click', closeCreateDialog)
    els.createDialogOverlay?.addEventListener('click', event => {
      if (event.target === els.createDialogOverlay) closeCreateDialog()
    })

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && els.createDialogOverlay?.classList.contains('is-open')) {
        closeCreateDialog()
      }
    })

    els.form.addEventListener('submit', handleCreateActivity)
  }

  init()
})
</script>

<template>
  <main class="app-shell">
    <div class="app-scroll">
      <header class="sheet-topbar">
        <button class="cancel-link" id="cancel-button" type="button">取消</button>
      </header>

      <section class="page">
        <h1 class="page-title">建立新球局</h1>

        <form class="form-block" id="create-activity-form">
          <section class="section" aria-labelledby="details-title">
            <h2 class="section-title" id="details-title">詳細資訊</h2>
            <input id="game-type" name="gameType" type="hidden" value="season" />

            <label class="field">
              <span class="field-label">標題</span>
              <input id="activity-title" name="activityTitle" type="text" autocomplete="off" />
            </label>

            <label class="field">
              <span class="field-label">地點</span>
              <input id="location" name="location" type="text" autocomplete="off" />
            </label>

            <div class="field">
              <p class="field-label" id="date-field-label">日期（多選）</p>
              <button class="control-button" id="date-picker-button" type="button">請選擇日期</button>
              <input id="activity-dates" name="activityDates" type="hidden" />
              <p class="date-count-note helper-note" id="date-count-note" hidden>共 0 次</p>
            </div>

            <div class="field">
              <p class="field-label">時間</p>
              <div class="time-row">
                <span class="select-wrap">
                  <select id="activity-start-time" name="activityStartTime" class="is-placeholder" data-time-select data-time-placeholder="開始時間">
                    <option value="">開始時間</option>
                  </select>
                </span>
                <span class="inline-text">至</span>
                <span class="select-wrap">
                  <select id="activity-end-time" name="activityEndTime" class="is-placeholder" data-time-select data-time-placeholder="結束時間">
                    <option value="">結束時間</option>
                  </select>
                </span>
              </div>
            </div>

            <div class="field">
              <p class="field-label">單次收費</p>
              <div class="fee-grid">
                <label class="fee-mini-field">
                  <span class="mini-label">季打</span>
                  <span class="money-input">
                    <span>$</span>
                    <input id="season-single-fee" name="seasonSingleFee" type="number" min="0" inputmode="numeric" />
                  </span>
                </label>
                <label class="fee-mini-field">
                  <span class="mini-label">臨打</span>
                  <span class="money-input">
                    <span>$</span>
                    <input id="pickup-single-fee" name="pickupSingleFee" type="number" min="0" inputmode="numeric" />
                  </span>
                </label>
                <label class="fee-mini-field">
                  <span class="mini-label">冷氣</span>
                  <span class="money-input">
                    <span>$</span>
                    <input id="ac-fee" name="acFee" type="number" min="0" inputmode="numeric" />
                  </span>
                </label>
              </div>
            </div>

            <label class="field">
              <span class="field-label">單次人數</span>
              <input id="single-capacity" name="singleCapacity" type="number" min="1" value="18" inputmode="numeric" />
            </label>
          </section>

          <div class="section-divider" aria-hidden="true"></div>

          <section class="section season-area" id="season-area" aria-labelledby="season-title">
            <div class="section-header">
              <div>
                <h2 class="section-title" id="season-title">季打報名開放</h2>
                <p class="section-note" id="season-disabled-note" hidden>球局次數需 4 次以上</p>
              </div>
              <button class="switch is-on" id="season-switch" type="button" role="switch" aria-checked="true" aria-label="季打報名開放"></button>
            </div>

            <div class="field-list season-fields" id="season-fields">
              <div class="field">
                <p class="field-label"><strong>季打費用</strong></p>
                <div class="fee-card">
                  <label class="fee-check-row">
                    <input id="season-include-ac" name="seasonIncludeAc" type="checkbox" checked hidden />
                    <span class="fee-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M5 12.5L9.5 17L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span>
                    <span>含冷氣費</span>
                  </label>
                  <label class="fee-input-row">
                    <span>$</span>
                    <input id="season-fee" name="seasonFee" type="text" inputmode="numeric" aria-label="季打費用" placeholder=" " readonly />
                    <span class="fee-unit">/人</span>
                  </label>
                </div>
                <p class="auto-note fee-note">*自動填入</p>
              </div>

              <label class="field">
                <span class="field-label">季打名額</span>
                <span class="select-wrap">
                  <select id="season-capacity" name="seasonCapacity" class="is-placeholder">
                    <option value="">請選擇人數</option>
                  </select>
                </span>
              </label>

              <div class="field">
                <p class="field-label">季打開放報名時間</p>
                <div class="time-row">
                  <button class="control-button" id="season-open-date-button" type="button">請選擇日期</button>
                  <input id="season-open-date" name="seasonOpenDate" type="hidden" />
                  <span class="inline-text">的</span>
                  <span class="select-wrap">
                    <select id="season-open-time" name="seasonOpenTime" class="is-placeholder" data-time-select data-time-placeholder="幾點">
                      <option value="">幾點</option>
                    </select>
                  </span>
                </div>
              </div>

              <div class="field">
                <p class="field-label"><strong>季打截止時間</strong></p>
                <div class="choice-stack">
                  <div class="choice-card is-active is-condensed" role="button" tabindex="0" data-season-deadline-type="unlimited" aria-pressed="true">
                    <span class="radio-mark" aria-hidden="true"></span>
                    <span class="choice-summary">
                      <span class="choice-title">不限時間</span>
                      <span class="choice-copy">管理員可手動關閉</span>
                    </span>
                  </div>
                  <div class="choice-card is-condensed" role="button" tabindex="0" data-season-deadline-type="custom" aria-pressed="false">
                    <span class="radio-mark" aria-hidden="true"></span>
                    <span class="choice-content">
                      <span class="choice-title">設定截止時間</span>
                      <span class="choice-rule is-date-time">
                        <button class="control-button" id="season-close-date-button" type="button">請選擇日期</button>
                        <input id="season-close-date" name="seasonCloseDate" type="hidden" />
                        <span>的</span>
                        <span class="select-wrap">
                          <select id="season-close-time" name="seasonCloseTime" class="is-placeholder" data-time-select data-time-placeholder="幾點">
                            <option value="">幾點</option>
                          </select>
                        </span>
                      </span>
                    </span>
                  </div>
                </div>
                <input id="season-deadline-type" name="seasonDeadlineType" type="hidden" value="unlimited" />
              </div>
            </div>
          </section>

          <div class="section-divider" aria-hidden="true"></div>

          <section class="section" aria-labelledby="pickup-title">
            <h2 class="section-title" id="pickup-title">臨打報名</h2>
            <div class="field">
              <p class="field-label">開放時間</p>
              <div class="time-row is-rule">
                <span class="inline-text">每次活動</span>
                <span class="select-wrap">
                  <select id="pickup-open-date" name="pickupOpenDate" class="is-placeholder">
                    <option value="">幾天前</option>
                    <option>前 1 天</option>
                    <option>前 2 天</option>
                    <option>前 3 天</option>
                    <option>前 4 天</option>
                    <option>前 5 天</option>
                    <option>前 6 天</option>
                    <option>前 7 天</option>
                  </select>
                </span>
                <span class="inline-text">的</span>
                <span class="select-wrap">
                  <select id="pickup-open-time" name="pickupOpenTime" class="is-placeholder" data-time-select data-time-placeholder="幾點">
                    <option value="">幾點</option>
                  </select>
                </span>
              </div>
            </div>

            <div class="field">
              <p class="field-label"><strong>截止時間</strong></p>
              <div class="choice-stack">
                <div class="choice-card is-active is-condensed" role="button" tabindex="0" data-deadline-type="unlimited" aria-pressed="true">
                  <span class="radio-mark" aria-hidden="true"></span>
                  <span class="choice-summary">
                    <span class="choice-title">不限時間</span>
                    <span class="choice-copy">活動開始前皆可報名</span>
                  </span>
                </div>
                <div class="choice-card is-condensed" role="button" tabindex="0" data-deadline-type="custom" aria-pressed="false">
                  <span class="radio-mark" aria-hidden="true"></span>
                  <span class="choice-content">
                    <span class="choice-title">設定截止時間</span>
                    <span class="choice-rule">
                      <span>每次活動</span>
                      <span class="select-wrap">
                        <select id="pickup-close-date" name="pickupCloseDate" class="is-placeholder">
                          <option value="">幾天前</option>
                          <option>前 1 天</option>
                          <option>前 2 天</option>
                          <option>前 3 天</option>
                          <option>前 4 天</option>
                          <option>前 5 天</option>
                          <option>前 6 天</option>
                          <option>前 7 天</option>
                        </select>
                      </span>
                      <span>的</span>
                      <span class="select-wrap">
                        <select id="pickup-close-time" name="pickupCloseTime" class="is-placeholder" data-time-select data-time-placeholder="幾點">
                          <option value="">幾點</option>
                        </select>
                      </span>
                    </span>
                  </span>
                </div>
              </div>
              <input id="deadline-type" name="deadlineType" type="hidden" value="unlimited" />
            </div>
          </section>
        </form>
      </section>
    </div>

    <div class="cta-fade">
      <button class="submit-button" type="submit" form="create-activity-form">建立球局</button>
    </div>

    <div class="calendar-overlay" id="calendar-overlay" aria-hidden="true">
      <section class="calendar-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
        <div class="calendar-header">
          <button class="calendar-nav" id="calendar-prev" type="button" aria-label="上一個月">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <h2 class="calendar-title" id="calendar-title"></h2>
          <button class="calendar-nav" id="calendar-next" type="button" aria-label="下一個月">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
              <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div class="calendar-weekdays" aria-hidden="true"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
        <div class="calendar-grid" id="calendar-grid"></div>
        <div class="calendar-actions">
          <button class="calendar-action is-muted" id="calendar-cancel" type="button">取消</button>
          <button class="calendar-action is-primary" id="calendar-done" type="button">完成</button>
        </div>
      </section>
    </div>

    <div class="time-overlay" id="time-overlay" aria-hidden="true">
      <section class="time-sheet" role="dialog" aria-modal="true" aria-labelledby="time-title">
        <div class="time-header">
          <h2 class="time-title" id="time-title">選擇時間</h2>
          <button class="time-close" id="time-close" type="button">完成</button>
        </div>
        <div class="time-wheels" aria-label="時間選擇器">
          <div class="time-wheel-column">
            <button class="time-wheel-arrow" type="button" data-time-wheel-step="hour" data-direction="-1" aria-label="小時減少">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 14L12 9L17 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div class="time-wheel" id="time-hour-wheel" aria-label="小時"></div>
            <button class="time-wheel-arrow" type="button" data-time-wheel-step="hour" data-direction="1" aria-label="小時增加">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
          <div class="time-wheel-column">
            <button class="time-wheel-arrow" type="button" data-time-wheel-step="minute" data-direction="-1" aria-label="分鐘減少">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 14L12 9L17 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div class="time-wheel" id="time-minute-wheel" aria-label="分鐘"></div>
            <button class="time-wheel-arrow" type="button" data-time-wheel-step="minute" data-direction="1" aria-label="分鐘增加">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
          <div class="time-wheel-column">
            <button class="time-wheel-arrow" type="button" data-time-wheel-step="period" data-direction="-1" aria-label="上午下午切換">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 14L12 9L17 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div class="time-wheel" id="time-period-wheel" aria-label="上午或下午"></div>
            <button class="time-wheel-arrow" type="button" data-time-wheel-step="period" data-direction="1" aria-label="上午下午切換">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        <div class="time-actions">
          <button class="time-action is-muted" id="time-cancel" type="button">取消</button>
          <button class="time-action is-primary" id="time-done" type="button">完成</button>
        </div>
      </section>
    </div>

    <div class="success-dialog-overlay" id="create-dialog-overlay" aria-hidden="true" inert>
      <section class="success-dialog" role="dialog" aria-modal="true" aria-labelledby="create-dialog-title">
        <h2 class="success-dialog-title" id="create-dialog-title">球局建立成功</h2>
        <p class="success-dialog-copy" id="create-dialog-copy">新球局已建立完成。</p>
        <button class="success-dialog-button" id="create-dialog-button" type="button">確認</button>
      </section>
    </div>
  </main>
</template>

<style>
:root {
  --primary: #6574ff;
  --secondary: #1bc4bf;
  --text: #101840;
  --muted: #8f95b2;
  --muted-soft: #8f95b2;
  --line: #d8dae5;
  --line-soft: #e6e8f0;
  --section: #f6f6f6;
  --surface: #ffffff;
  --selected: #eef1ff;
  --shadow: 0 24px 64px rgba(30, 42, 110, 0.16);
}

* {
  box-sizing: border-box;
  touch-action: manipulation;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  color: var(--text);
  background: radial-gradient(circle at top, rgba(87, 104, 255, 0.14), transparent 32%), linear-gradient(180deg, #f5f6fb 0%, #edf0f8 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 16px;
}

button,
input,
select {
  font: inherit;
}

button {
  border: 0;
  padding: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}

input,
select {
  width: 100%;
  min-height: 41px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  color: var(--text);
  font-size: 15px;
  line-height: 1.5;
  outline: none;
  appearance: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

input::placeholder {
  color: var(--muted-soft);
}

select.is-placeholder {
  color: var(--muted-soft);
}

input:focus,
select:focus,
.control-button:focus {
  border-color: rgba(87, 104, 255, 0.72);
  box-shadow: 0 0 0 3px rgba(87, 104, 255, 0.12);
}

select {
  background-image: linear-gradient(45deg, transparent 50%, #646a80 50%), linear-gradient(135deg, #646a80 50%, transparent 50%);
  background-position:
    calc(100% - 18px) 50%,
    calc(100% - 12px) 50%;
  background-size:
    6px 6px,
    6px 6px;
  background-repeat: no-repeat;
  padding-right: 36px;
}

.app-shell {
  width: min(100%, 390px);
  height: min(844px, calc(100vh - 48px));
  background: var(--surface);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: var(--shadow);
  position: relative;
}

.app-scroll {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 188px;
}

.app-scroll::-webkit-scrollbar {
  display: none;
}

.sheet-topbar {
  position: sticky;
  top: 0;
  z-index: 6;
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
}

.cancel-link {
  color: var(--muted-soft);
  font-size: 15px;
  line-height: 1.4;
}

.page {
  padding: 24px 16px 0;
}

.page-title {
  margin: 0 0 20px;
  color: var(--text);
  font-size: 24px;
  line-height: 1.36;
  letter-spacing: 0.48px;
  font-weight: 600;
}

.form-block,
.section,
.field-list,
.field {
  display: grid;
}

.section {
  gap: 18px;
}

.section-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.36;
  letter-spacing: 0.36px;
  font-weight: 600;
}

.section-note {
  margin: 4px 0 0;
  color: var(--muted-soft);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 400;
}

.section-note.is-alert {
  color: #d14343;
}

.section-note[hidden] {
  display: none;
}

.section-divider {
  height: 8px;
  margin: 22px -16px 20px;
  background: var(--section);
}

.field-list {
  gap: 20px;
}

.field {
  gap: 8px;
  min-width: 0;
}

.field-label {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  line-height: 1.35;
  font-weight: 600;
}

.control-button {
  min-height: 41px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  color: var(--muted-soft);
  font-size: 15px;
  line-height: 1.5;
  text-align: left;
}

.control-button.has-value {
  color: var(--text);
}

.control-button::after {
  content: '';
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid #646a80;
  border-radius: 2px;
  flex: 0 0 auto;
  margin-left: 12px;
}

.helper-note,
.auto-note {
  margin: 0;
  color: var(--secondary);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 400;
}

.date-count-note[hidden],
.season-area[hidden] {
  display: none;
}

.time-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.time-row.is-rule {
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
}

.inline-text {
  color: var(--text);
  font-size: 14px;
  line-height: 1;
  white-space: nowrap;
}

.select-wrap {
  display: block;
  min-width: 0;
  position: relative;
}

.select-wrap select[data-time-select] {
  pointer-events: none;
}

.fee-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.fee-mini-field {
  display: grid;
  gap: 8px;
}

.mini-label {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.2;
  font-weight: 400;
}

.money-input {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 41px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  color: var(--text);
  font-size: 15px;
  line-height: 1.25;
}

.money-input input {
  min-height: 0;
  border: 0;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  font-size: 15px;
}

.fee-card {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
}

.fee-check-row {
  min-height: 41px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid var(--line-soft);
  color: var(--text);
  font-size: 13px;
  line-height: 1.25;
  font-weight: 400;
  cursor: pointer;
}

.fee-check {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: 1.5px solid #1bc4bf;
  border-radius: 4px;
  background: #1bc4bf;
  color: #fff;
  flex: 0 0 auto;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

#season-include-ac:not(:checked) + .fee-check {
  border-color: var(--line-soft);
  background: #fff;
  color: transparent;
}

.fee-check svg {
  width: 14px;
  height: 14px;
}

.fee-input-row {
  min-height: 41px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  color: var(--text);
  font-size: 15px;
  line-height: 1.25;
  white-space: nowrap;
}

.fee-input-row input {
  min-height: 0;
  border: 0;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  font-size: 15px;
}

#season-fee {
  width: calc((var(--season-fee-digits, 1) * 1ch) + 2px);
  flex: 0 0 auto;
}

.fee-unit {
  margin-left: 0;
}

.fee-input-row input:placeholder-shown + .fee-unit {
  display: none;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.switch {
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: #dfe3ee;
  padding: 2px;
  transition: background-color 0.2s ease;
  flex: 0 0 auto;
}

.switch::after {
  content: '';
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}

.switch.is-on {
  background: var(--secondary);
}

.switch.is-on::after {
  transform: translateX(16px);
}

.switch.is-disabled {
  cursor: default;
  opacity: 0.5;
}

.season-fields {
  overflow: hidden;
  transition:
    max-height 0.24s ease,
    opacity 0.2s ease,
    margin-top 0.2s ease;
  max-height: 900px;
  opacity: 1;
}

.season-fields.is-collapsed {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
}

.season-area.is-collapsed {
  gap: 0;
}

.season-area.is-collapsed + .section-divider {
  margin-top: 20px;
}

.choice-stack {
  display: grid;
  gap: 12px;
}

.choice-card {
  min-height: 80px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  padding: 14px;
}

.choice-card.is-condensed {
  align-items: center;
  min-height: 66px;
}

.choice-card.is-active {
  border-color: var(--primary);
}

.radio-mark {
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--line-soft);
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  margin-top: 2px;
}

.choice-card.is-active .radio-mark {
  border-color: var(--primary);
}

.choice-card.is-active .radio-mark::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
}

.choice-summary,
.choice-content {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.choice-title {
  color: var(--text);
  font-size: 15px;
  line-height: 1.35;
  font-weight: 600;
}

.choice-copy {
  color: var(--muted-soft);
  font-size: 13px;
  line-height: 1.3;
  font-weight: 400;
}

.choice-rule {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  color: var(--text);
  font-size: 14px;
  line-height: 1.35;
}

.time-row.is-rule select,
.choice-rule select {
  font-size: 15px;
}

.choice-rule.is-date-time {
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

#date-picker-button,
#season-capacity,
#season-open-date-button,
#season-open-time,
#season-close-date-button,
#season-close-time,
.money-input,
.money-input input {
  font-size: 15px;
}

.choice-card.is-condensed .choice-rule {
  display: none;
}

.cta-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 8;
  padding: 46px 16px 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #fff 38%, #fff 100%);
  pointer-events: none;
}

.submit-button {
  width: 100%;
  min-height: 54px;
  border-radius: 10px;
  background: var(--secondary);
  color: #fff;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
  pointer-events: auto;
}

.calendar-overlay,
.time-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: none;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.32);
}

.calendar-overlay.is-open,
.time-overlay.is-open {
  display: flex;
}

.calendar-sheet,
.time-sheet {
  width: 100%;
  padding: 16px;
  border-radius: 18px 18px 0 0;
  background: #fff;
}

.calendar-header,
.time-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.calendar-title,
.time-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.36;
  font-weight: 600;
}

.calendar-nav,
.time-close {
  min-width: 40px;
  min-height: 36px;
  display: grid;
  place-items: center;
  color: var(--primary);
}

.time-close {
  font-size: 15px;
  font-weight: 500;
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-weekdays {
  margin-bottom: 6px;
  color: var(--muted-soft);
  font-size: 12px;
  text-align: center;
}

.calendar-day {
  min-height: 36px;
  border-radius: 9px;
  color: var(--text);
  font-size: 14px;
}

.calendar-day.is-muted {
  color: #bdc1d1;
}

.calendar-day.is-selected {
  background: var(--primary);
  color: #fff;
}

.calendar-actions,
.time-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.calendar-action,
.time-action {
  min-height: 44px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
}

.calendar-action.is-muted,
.time-action.is-muted {
  background: #f4f6fa;
  color: var(--muted);
}

.calendar-action.is-primary,
.time-action.is-primary {
  background: var(--primary);
  color: #fff;
}

.time-wheels {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  padding: 8px 0;
}

.time-wheels::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 44px;
  border-radius: 10px;
  background: #f4f6fa;
  transform: translateY(-50%);
  pointer-events: none;
}

.time-wheel-column {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 4px;
}

.time-wheel {
  height: 220px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.time-wheel::-webkit-scrollbar {
  display: none;
}

.time-wheel::before,
.time-wheel::after {
  content: '';
  display: block;
  height: 88px;
}

.time-wheel-option {
  min-height: 44px;
  width: 100%;
  display: grid;
  place-items: center;
  scroll-snap-align: center;
  color: #9aa0b8;
  font-size: 22px;
  line-height: 1;
  font-weight: 400;
}

.time-wheel-option.is-selected {
  color: var(--text);
  font-size: 26px;
  font-weight: 500;
}

.time-wheel-arrow {
  display: none;
  min-height: 28px;
  place-items: center;
  color: var(--muted);
  border-radius: 8px;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.time-wheel-arrow svg {
  width: 18px;
  height: 18px;
}

.time-wheel-arrow:hover {
  background: #f4f6fa;
  color: var(--text);
}

.success-dialog-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.24s ease;
}

.success-dialog-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

.success-dialog {
  width: min(100%, 318px);
  border-radius: 16px;
  background: #fff;
  padding: 28px 22px 22px;
  box-shadow: 0 22px 52px rgba(16, 24, 64, 0.2);
  text-align: center;
  transform: translateY(10px) scale(0.98);
  transition: transform 0.24s ease;
}

.success-dialog-overlay.is-open .success-dialog {
  transform: translateY(0) scale(1);
}

.success-dialog-title {
  margin: 0;
  color: var(--text);
  font-size: 20px;
  line-height: 1.4;
  font-weight: 600;
}

.success-dialog-copy {
  margin: 12px 0 24px;
  color: #474d66;
  font-size: 15px;
  line-height: 1.5;
  font-weight: 400;
}

.success-dialog-button {
  width: 100%;
  min-height: 48px;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
}

@media (hover: hover) and (pointer: fine) {
  .time-wheel-arrow {
    display: grid;
  }

  .time-wheel {
    height: 176px;
  }

  .time-wheel::before,
  .time-wheel::after {
    height: 66px;
  }
}

@media (max-width: 500px) {
  body {
    padding: 0;
    display: block;
    background: #fff;
  }

  input,
  select,
  .money-input input,
  .fee-input-row input {
    font-size: 15px;
  }

  #season-single-fee,
  #pickup-single-fee,
  #ac-fee,
  #season-capacity,
  #season-open-date-button,
  #season-open-time,
  #season-close-date-button,
  #season-close-time,
  .money-input,
  .money-input input {
    font-size: 15px;
  }

  .time-row.is-rule select,
  .choice-rule select {
    font-size: 15px;
  }

  .app-shell {
    width: 100%;
    height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }
}

input.is-error,
select.is-error,
.control-button.is-error,
.money-input.is-error {
  border-color: #d14343;
  box-shadow: 0 0 0 3px rgba(209, 67, 67, 0.12);
}
</style>
