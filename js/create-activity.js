// ─── DOM refs ──────────────────────────────────────────────────────────────

const els = {
  form:                     document.getElementById("create-activity-form"),
  cancelButton:             document.getElementById("cancel-button"),
  seasonArea:               document.getElementById("season-area"),
  seasonSwitch:             document.getElementById("season-switch"),
  seasonFields:             document.getElementById("season-fields"),
  seasonDisabledNote:       document.getElementById("season-disabled-note"),
  dateButton:               document.getElementById("date-picker-button"),
  dateFieldLabel:           document.getElementById("date-field-label"),
  dateCountNote:            document.getElementById("date-count-note"),
  dateInput:                document.getElementById("activity-dates"),
  seasonOpenDateButton:     document.getElementById("season-open-date-button"),
  seasonOpenDateInput:      document.getElementById("season-open-date"),
  seasonCloseDateButton:    document.getElementById("season-close-date-button"),
  seasonCloseDateInput:     document.getElementById("season-close-date"),
  calendarOverlay:          document.getElementById("calendar-overlay"),
  calendarTitle:            document.getElementById("calendar-title"),
  calendarGrid:             document.getElementById("calendar-grid"),
  calendarPrev:             document.getElementById("calendar-prev"),
  calendarNext:             document.getElementById("calendar-next"),
  calendarCancel:           document.getElementById("calendar-cancel"),
  calendarDone:             document.getElementById("calendar-done"),
  deadlineInput:            document.getElementById("deadline-type"),
  deadlineButtons:          document.querySelectorAll("[data-deadline-type]"),
  customDeadlineCard:       document.querySelector('[data-deadline-type="custom"]'),
  seasonDeadlineInput:      document.getElementById("season-deadline-type"),
  seasonDeadlineButtons:    document.querySelectorAll("[data-season-deadline-type]"),
  customSeasonDeadlineCard: document.querySelector('[data-season-deadline-type="custom"]'),
  seasonCapacity:           document.getElementById("season-capacity"),
  seasonSingleFee:          document.getElementById("season-single-fee"),
  acFee:                    document.getElementById("ac-fee"),
  seasonFee:                document.getElementById("season-fee"),
  seasonIncludeAc:          document.getElementById("season-include-ac"),
  timeOverlay:              document.getElementById("time-overlay"),
  timeClose:                document.getElementById("time-close"),
  timeCancel:               document.getElementById("time-cancel"),
  timeDone:                 document.getElementById("time-done"),
  timeHourWheel:            document.getElementById("time-hour-wheel"),
  timeMinuteWheel:          document.getElementById("time-minute-wheel"),
  timePeriodWheel:          document.getElementById("time-period-wheel"),
  createDialogOverlay:      document.getElementById("create-dialog-overlay"),
  createDialogTitle:        document.getElementById("create-dialog-title"),
  createDialogCopy:         document.getElementById("create-dialog-copy"),
  createDialogButton:       document.getElementById("create-dialog-button"),
};

let shouldReturnAfterDialog = false;

// ─── Utilities ─────────────────────────────────────────────────────────────

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day   = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDateLabel(value) {
  const parts = value.split("-");
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function to24Hour(hour, minute, period) {
  let h = Number(hour);
  if (period === "AM") h = h === 12 ? 0 : h;
  else                 h = h === 12 ? 12 : h + 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function from24Hour(value) {
  if (!value) return { hour: "06", minute: "00", period: "AM" };
  const parts = value.split(":");
  const h     = Number(parts[0]);
  return {
    hour:   String(h % 12 || 12).padStart(2, "0"),
    minute: parts[1] || "00",
    period: h >= 12 ? "PM" : "AM",
  };
}

function syncSelectPlaceholder(select) {
  select.classList.toggle("is-placeholder", select.value === "");
}

function returnToPreviousPage() {
  if (window.history.length > 1) window.history.back();
  else window.location.href = "./group-list.html";
}

function goToCreatedActivityList() {
  window.location.href = "./group-list.html";
}

function setCreateDialogOpen(isOpen, options = {}) {
  if (!els.createDialogOverlay) return;

  if (isOpen) {
    if (options.title) els.createDialogTitle.textContent = options.title;
    if (options.copy) els.createDialogCopy.textContent = options.copy;
    if (options.buttonText) els.createDialogButton.textContent = options.buttonText;
    shouldReturnAfterDialog = Boolean(options.returnAfterClose);
  }

  els.createDialogOverlay.classList.toggle("is-open", isOpen);
  els.createDialogOverlay.setAttribute("aria-hidden", String(!isOpen));
  els.createDialogOverlay.inert = !isOpen;

  const focusTarget = isOpen ? els.createDialogButton : document.querySelector(".submit-button");
  focusTarget?.focus({ preventScroll: true });
}

function closeCreateDialog() {
  const shouldReturn = shouldReturnAfterDialog;
  shouldReturnAfterDialog = false;
  setCreateDialogOpen(false);
  if (shouldReturn) goToCreatedActivityList();
}

// ─── TimePicker ────────────────────────────────────────────────────────────

const TimePicker = {
  activeSelect:  null,
  value:         { hour: "06", minute: "00", period: "AM" },
  scrollTimers:  new WeakMap(),

  buildWheel(wheel, values, key) {
    wheel.innerHTML = "";
    values.forEach((v) => {
      const btn = document.createElement("button");
      btn.className    = "time-wheel-option";
      btn.type         = "button";
      btn.dataset.value = v;
      btn.textContent  = v;
      btn.addEventListener("click", () => {
        this.value[key] = v;
        this.syncSelection();
        this.scrollToValue(wheel, v, "smooth");
      });
      wheel.appendChild(btn);
    });

    wheel.addEventListener("scroll", () => {
      clearTimeout(this.scrollTimers.get(wheel));
      this.scrollTimers.set(wheel, setTimeout(() => {
        const opt = this.getCenteredOption(wheel);
        if (!opt) return;
        this.value[key] = opt.dataset.value;
        this.syncSelection();
      }, 90));
    }, { passive: true });
  },

  getCenteredOption(wheel) {
    const options = Array.from(wheel.querySelectorAll(".time-wheel-option"));
    const center  = wheel.getBoundingClientRect().top + wheel.clientHeight / 2;
    return options.reduce((closest, opt) => {
      const dist = Math.abs(opt.getBoundingClientRect().top + opt.offsetHeight / 2 - center);
      return !closest || dist < closest.dist ? { opt, dist } : closest;
    }, null).opt;
  },

  scrollToValue(wheel, value, behavior = "auto") {
    const opt = wheel.querySelector(`[data-value="${value}"]`);
    if (!opt) return;
    wheel.scrollTo({
      top: opt.offsetTop - (wheel.clientHeight - opt.offsetHeight) / 2,
      behavior,
    });
  },

  syncSelection() {
    [
      { wheel: els.timeHourWheel,   key: "hour"   },
      { wheel: els.timeMinuteWheel, key: "minute" },
      { wheel: els.timePeriodWheel, key: "period" },
    ].forEach(({ wheel, key }) => {
      wheel.querySelectorAll(".time-wheel-option").forEach((opt) => {
        opt.classList.toggle("is-selected", opt.dataset.value === this.value[key]);
      });
    });
  },

  step(key, direction) {
    const wheels = {
      hour:   els.timeHourWheel,
      minute: els.timeMinuteWheel,
      period: els.timePeriodWheel,
    };
    const wheel = wheels[key];
    if (!wheel) return;
    const options = Array.from(wheel.querySelectorAll(".time-wheel-option"));
    let idx = options.findIndex((o) => o.dataset.value === this.value[key]) + Number(direction);
    if (idx < 0)              idx = options.length - 1;
    if (idx >= options.length) idx = 0;
    this.value[key] = options[idx].dataset.value;
    this.syncSelection();
    this.scrollToValue(wheel, this.value[key], "smooth");
  },

  setOpen(isOpen, select) {
    els.timeOverlay.classList.toggle("is-open", isOpen);
    els.timeOverlay.setAttribute("aria-hidden", String(!isOpen));
    if (!isOpen) { this.activeSelect = null; return; }

    this.activeSelect = select;
    this.value        = from24Hour(select.value);
    this.syncSelection();
    requestAnimationFrame(() => {
      this.scrollToValue(els.timeHourWheel,   this.value.hour);
      this.scrollToValue(els.timeMinuteWheel, this.value.minute);
      this.scrollToValue(els.timePeriodWheel, this.value.period);
    });
  },

  commit() {
    if (!this.activeSelect) return;
    const value = to24Hour(this.value.hour, this.value.minute, this.value.period);
    this.activeSelect.value = value;
    syncSelectPlaceholder(this.activeSelect);
    this.activeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    this.setOpen(false);
  },

  init() {
    const hours   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
    const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
    this.buildWheel(els.timeHourWheel,   hours,            "hour");
    this.buildWheel(els.timeMinuteWheel, minutes,          "minute");
    this.buildWheel(els.timePeriodWheel, ["AM", "PM"],     "period");

    document.querySelectorAll("[data-time-wheel-step]").forEach((btn) => {
      btn.addEventListener("click", () => this.step(btn.dataset.timeWheelStep, btn.dataset.direction));
    });

    document.querySelectorAll("[data-time-select]").forEach((select) => {
      const wrapper = select.closest(".select-wrap");
      if (wrapper) wrapper.addEventListener("click", () => this.setOpen(true, select));
    });

    els.timeClose.addEventListener("click",  () => this.commit());
    els.timeDone.addEventListener("click",   () => this.commit());
    els.timeCancel.addEventListener("click", () => this.setOpen(false));
    els.timeOverlay.addEventListener("click", (e) => {
      if (e.target === els.timeOverlay) this.setOpen(false);
    });
  },
};

// ─── CalendarPicker ────────────────────────────────────────────────────────

const CalendarPicker = {
  activeTarget:   "activity",
  selectedDates:  [],
  seasonOpenDate: "",
  seasonCloseDate: "",
  visibleMonth:   (() => { const d = new Date(); d.setDate(1); return d; })(),

  getSelectedValues() {
    if (this.activeTarget === "season-open")  return this.seasonOpenDate  ? [this.seasonOpenDate]  : [];
    if (this.activeTarget === "season-close") return this.seasonCloseDate ? [this.seasonCloseDate] : [];
    return this.selectedDates;
  },

  syncDateText() {
    els.dateInput.value = this.selectedDates.join(",");
    els.dateButton.classList.toggle("has-value", this.selectedDates.length > 0);
    if (this.selectedDates.length > 0) els.dateButton.classList.remove("is-error");
    els.dateButton.textContent = this.selectedDates.length
      ? this.selectedDates.map(formatDateLabel).join("、")
      : "請選擇日期";
    els.dateCountNote.hidden      = this.selectedDates.length === 0;
    els.dateCountNote.textContent = `共 ${this.selectedDates.length} 次`;
    if (this.selectedDates.length > 0) {
      const earliest = new Date(this.selectedDates[0]);
      earliest.setDate(earliest.getDate() - 30);
      this.seasonOpenDate = formatDate(earliest);
      this.syncSingleDateText("season-open");
    }

    Season.updateFee();
    Season.syncAvailability();
  },

  syncSingleDateText(target) {
    const isOpen    = target === "season-open";
    const value     = isOpen ? this.seasonOpenDate  : this.seasonCloseDate;
    const button    = isOpen ? els.seasonOpenDateButton  : els.seasonCloseDateButton;
    const input     = isOpen ? els.seasonOpenDateInput   : els.seasonCloseDateInput;
    input.value     = value;
    button.classList.toggle("has-value", Boolean(value));
    if (value) button.classList.remove("is-error");
    button.textContent = value ? formatDateLabel(value) : "請選擇日期";
  },

  render() {
    const year        = this.visibleMonth.getFullYear();
    const month       = this.visibleMonth.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const gridStart   = new Date(year, month, 1 - startOffset);
    const selected    = this.getSelectedValues();

    els.calendarTitle.textContent = `${year} 年 ${month + 1} 月`;
    els.calendarGrid.innerHTML    = "";

    for (let i = 0; i < 42; i++) {
      const date  = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const value = formatDate(date);

      const btn = document.createElement("button");
      btn.className    = "calendar-day";
      btn.type         = "button";
      btn.textContent  = String(date.getDate());
      btn.dataset.date = value;
      if (date.getMonth() !== month)    btn.classList.add("is-muted");
      if (selected.indexOf(value) !== -1) btn.classList.add("is-selected");

      btn.addEventListener("click", () => {
        if (this.activeTarget === "season-open") {
          this.seasonOpenDate = value;
          this.syncSingleDateText("season-open");
        } else if (this.activeTarget === "season-close") {
          this.seasonCloseDate = value;
          this.syncSingleDateText("season-close");
        } else {
          const idx = this.selectedDates.indexOf(value);
          if (idx === -1) this.selectedDates.push(value);
          else            this.selectedDates.splice(idx, 1);
          this.selectedDates.sort();
          this.syncDateText();
        }
        this.render();
      });

      els.calendarGrid.appendChild(btn);
    }
  },

  setOpen(isOpen, target) {
    if (target) this.activeTarget = target;
    els.calendarOverlay.classList.toggle("is-open", isOpen);
    els.calendarOverlay.setAttribute("aria-hidden", String(!isOpen));
    if (isOpen) this.render();
  },

  init() {
    els.dateButton.addEventListener("click",             () => this.setOpen(true, "activity"));
    els.seasonOpenDateButton.addEventListener("click",   () => this.setOpen(true, "season-open"));
    els.seasonCloseDateButton.addEventListener("click",  () => this.setOpen(true, "season-close"));
    els.calendarPrev.addEventListener("click", () => {
      this.visibleMonth.setMonth(this.visibleMonth.getMonth() - 1);
      this.render();
    });
    els.calendarNext.addEventListener("click", () => {
      this.visibleMonth.setMonth(this.visibleMonth.getMonth() + 1);
      this.render();
    });
    els.calendarCancel.addEventListener("click", () => this.setOpen(false));
    els.calendarDone.addEventListener("click",   () => this.setOpen(false));
    els.calendarOverlay.addEventListener("click", (e) => {
      if (e.target === els.calendarOverlay) this.setOpen(false);
    });
  },
};

// ─── Choice Groups ─────────────────────────────────────────────────────────

function syncChoiceGroup(input, buttons, customCard, type, dataKey) {
  input.value = type;
  buttons.forEach((btn) => {
    const isActive = btn.dataset[dataKey] === type;
    btn.classList.toggle("is-active",   isActive);
    btn.classList.toggle("is-condensed", type === "unlimited");
    btn.setAttribute("aria-pressed", String(isActive));
  });
  if (customCard) customCard.classList.toggle("is-condensed", type === "unlimited");
}

function bindChoiceGroup(input, buttons, customCard, dataKey) {
  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (e.target.tagName === "SELECT") return;
      syncChoiceGroup(input, buttons, customCard, btn.dataset[dataKey], dataKey);
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      syncChoiceGroup(input, buttons, customCard, btn.dataset[dataKey], dataKey);
    });
  });
}

// ─── Season ────────────────────────────────────────────────────────────────

const Season = {
  updateFee() {
    const base  = Number(els.seasonSingleFee.value || 0);
    const ac    = els.seasonIncludeAc.checked ? Number(els.acFee.value || 0) : 0;
    const count = CalendarPicker.selectedDates.length;
    els.seasonFee.value = count > 0 ? String((base + ac) * count) : "";
    els.seasonFee.style.setProperty("--season-fee-digits", String(Math.max(els.seasonFee.value.length, 1)));
  },

  setOpen(isOpen) {
    els.seasonSwitch.classList.toggle("is-on", isOpen);
    els.seasonSwitch.setAttribute("aria-checked", String(isOpen));
    els.seasonFields.classList.toggle("is-collapsed", !isOpen);
    els.seasonArea.classList.toggle("is-collapsed",   !isOpen);
  },

  syncAvailability() {
    const below = CalendarPicker.selectedDates.length > 0 && CalendarPicker.selectedDates.length < 4;
    els.seasonSwitch.setAttribute("aria-disabled", String(below));
    els.seasonSwitch.classList.toggle("is-disabled", below);
    els.seasonDisabledNote.hidden = !below;
    els.seasonDisabledNote.classList.remove("is-alert");
    if (below) this.setOpen(false);
  },

  init() {
    els.seasonSwitch.addEventListener("click", () => {
      if (els.seasonSwitch.getAttribute("aria-disabled") === "true") {
        els.seasonDisabledNote.classList.add("is-alert");
        return;
      }
      this.setOpen(els.seasonSwitch.getAttribute("aria-checked") !== "true");
    });

    [els.seasonSingleFee, els.acFee, els.seasonIncludeAc].forEach((field) => {
      field.addEventListener("input",  () => this.updateFee());
      field.addEventListener("change", () => this.updateFee());
    });
  },
};

// ─── Selects ───────────────────────────────────────────────────────────────

function populateCapacityOptions() {
  const unlimited = document.createElement("option");
  unlimited.value       = "unlimited";
  unlimited.textContent = "不限";
  els.seasonCapacity.appendChild(unlimited);

  for (let n = 1; n <= 18; n++) {
    const opt = document.createElement("option");
    opt.value = opt.textContent = String(n);
    els.seasonCapacity.appendChild(opt);
  }
}

function populateTimeSelects() {
  document.querySelectorAll("[data-time-select]").forEach((select) => {
    const placeholder = select.dataset.timePlaceholder || "請選擇時間";
    select.innerHTML  = "";

    const ph = document.createElement("option");
    ph.value = ""; ph.textContent = placeholder;
    select.appendChild(ph);

    for (let m = 0; m < 24 * 60; m++) {
      const opt = document.createElement("option");
      opt.value = opt.textContent =
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      select.appendChild(opt);
    }
  });
}

function initSelectPlaceholders() {
  document.querySelectorAll("select").forEach((select) => {
    syncSelectPlaceholder(select);
    select.addEventListener("change", () => syncSelectPlaceholder(select));
  });
}

// ─── Validation ────────────────────────────────────────────────────────────

function validate() {
  const titleEl           = document.getElementById("activity-title");
  const locationEl        = document.getElementById("location");
  const startTimeEl       = document.getElementById("activity-start-time");
  const endTimeEl         = document.getElementById("activity-end-time");
  const seasonSingleFeeEl = document.getElementById("season-single-fee");
  const pickupSingleFeeEl = document.getElementById("pickup-single-fee");
  const singleCapacityEl  = document.getElementById("single-capacity");
  const seasonOpenTimeEl  = document.getElementById("season-open-time");
  const seasonCloseTimeEl = document.getElementById("season-close-time");
  const pickupOpenDateEl  = document.getElementById("pickup-open-date");
  const pickupOpenTimeEl  = document.getElementById("pickup-open-time");
  const pickupCloseDateEl = document.getElementById("pickup-close-date");
  const pickupCloseTimeEl = document.getElementById("pickup-close-time");

  // 費用欄位的 border 在 .money-input 父層，需對父層套用 is-error
  const errEl = (el) => el.closest(".money-input") || el;

  const fields = [
    { target: titleEl,                    ok: titleEl.value.trim() !== "" },
    { target: locationEl,                 ok: locationEl.value.trim() !== "" },
    { target: els.dateButton,             ok: CalendarPicker.selectedDates.length > 0 },
    { target: startTimeEl,                ok: startTimeEl.value !== "" },
    { target: endTimeEl,                  ok: endTimeEl.value !== "" },
    { target: errEl(seasonSingleFeeEl),   ok: seasonSingleFeeEl.value.trim() !== "" },
    { target: errEl(pickupSingleFeeEl),   ok: pickupSingleFeeEl.value.trim() !== "" },
    { target: errEl(els.acFee),           ok: els.acFee.value.trim() !== "" },
    { target: singleCapacityEl,           ok: singleCapacityEl.value.trim() !== "" },
    { target: pickupOpenDateEl,           ok: pickupOpenDateEl.value !== "" },
    { target: pickupOpenTimeEl,           ok: pickupOpenTimeEl.value !== "" },
  ];

  if (els.seasonSwitch.getAttribute("aria-checked") === "true") {
    fields.push(
      { target: els.seasonCapacity,        ok: els.seasonCapacity.value !== "" },
      { target: els.seasonOpenDateButton,  ok: CalendarPicker.seasonOpenDate !== "" },
      { target: seasonOpenTimeEl,          ok: seasonOpenTimeEl.value !== "" },
    );
    if (els.seasonDeadlineInput.value === "custom") {
      fields.push(
        { target: els.seasonCloseDateButton, ok: CalendarPicker.seasonCloseDate !== "" },
        { target: seasonCloseTimeEl,         ok: seasonCloseTimeEl.value !== "" },
      );
    }
  }

  if (els.deadlineInput.value === "custom") {
    fields.push(
      { target: pickupCloseDateEl, ok: pickupCloseDateEl.value !== "" },
      { target: pickupCloseTimeEl, ok: pickupCloseTimeEl.value !== "" },
    );
  }

  let firstError = null;
  fields.forEach(({ target, ok }) => {
    target.classList.toggle("is-error", !ok);
    if (!ok && !firstError) firstError = target;
  });

  if (firstError) {
    firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    setCreateDialogOpen(true, {
      title: "報名尚未完成",
      copy: "有部分必填欄位尚未填寫，請確認標示的欄位後再送出。",
      buttonText: "確認",
      returnAfterClose: false,
    });
  }
  return !firstError;
}

// ─── Form Submit ───────────────────────────────────────────────────────────

function buildActivityPayload() {
  const fd             = new FormData(els.form);
  const seasonEnabled  = els.seasonSwitch.getAttribute("aria-checked") === "true";
  const datesRaw       = fd.get("activityDates") || "";
  const dates          = datesRaw ? datesRaw.split(",") : [];

  function parseDaysBefore(raw) {
    const m = (raw || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  return {
    game_type:                fd.get("gameType") || "season",
    title:                    fd.get("activityTitle") || "",
    location:                 fd.get("location") || "",
    dates,
    start_time:               fd.get("activityStartTime") || null,
    end_time:                 fd.get("activityEndTime")   || null,
    season_fee_per_session:   Number(fd.get("seasonSingleFee")) || 0,
    pickup_fee_per_session:   Number(fd.get("pickupSingleFee")) || 0,
    ac_fee:                   Number(fd.get("acFee"))           || 0,
    single_capacity:          Number(fd.get("singleCapacity"))  || 18,
    season_enabled:           seasonEnabled,
    season_include_ac:        fd.get("seasonIncludeAc") === "on",
    season_total_fee:         Number(fd.get("seasonFee")) || 0,
    season_capacity:          fd.get("seasonCapacity")   || null,
    season_open_date:         fd.get("seasonOpenDate")   || null,
    season_open_time:         fd.get("seasonOpenTime")   || null,
    season_deadline_type:     fd.get("seasonDeadlineType") || "unlimited",
    season_close_date:        fd.get("seasonCloseDate")  || null,
    season_close_time:        fd.get("seasonCloseTime")  || null,
    pickup_open_days_before:  parseDaysBefore(fd.get("pickupOpenDate")),
    pickup_open_time:         fd.get("pickupOpenTime")   || null,
    pickup_deadline_type:     fd.get("deadlineType")     || "unlimited",
    pickup_close_days_before: parseDaysBefore(fd.get("pickupCloseDate")),
    pickup_close_time:        fd.get("pickupCloseTime")  || null,
  };
}

async function handleCreateActivity(event) {
  event.preventDefault();
  if (!validate()) return;

  const submitButton = document.querySelector(".submit-button");
  if (submitButton) {
    submitButton.disabled    = true;
    submitButton.textContent = "建立中…";
  }

  try {
    await api.createActivity(buildActivityPayload());
    setCreateDialogOpen(true, {
      title: "球局建立成功",
      copy: "新球局已建立完成。",
      buttonText: "確認",
      returnAfterClose: true,
    });
  } catch (err) {
    setCreateDialogOpen(true, {
      title: "建立失敗",
      copy: err.message || "請稍後再試",
      buttonText: "確認",
      returnAfterClose: false,
    });
  } finally {
    if (submitButton) {
      submitButton.disabled    = false;
      submitButton.textContent = "建立球局";
    }
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────

function init() {
  populateCapacityOptions();
  populateTimeSelects();
  initSelectPlaceholders();
  TimePicker.init();
  CalendarPicker.init();
  Season.init();

  bindChoiceGroup(els.deadlineInput,       els.deadlineButtons,       els.customDeadlineCard,       "deadlineType");
  bindChoiceGroup(els.seasonDeadlineInput, els.seasonDeadlineButtons, els.customSeasonDeadlineCard, "seasonDeadlineType");
  syncChoiceGroup(els.deadlineInput,       els.deadlineButtons,       els.customDeadlineCard,       "unlimited", "deadlineType");
  syncChoiceGroup(els.seasonDeadlineInput, els.seasonDeadlineButtons, els.customSeasonDeadlineCard, "unlimited", "seasonDeadlineType");

  els.dateFieldLabel.textContent   = "日期（多選）";
  els.seasonArea.hidden            = false;
  els.seasonCapacity.value         = "unlimited";
  syncSelectPlaceholder(els.seasonCapacity);

  const pickupOpenDateEl  = document.getElementById("pickup-open-date");
  const pickupOpenTimeEl  = document.getElementById("pickup-open-time");
  const seasonOpenTimeEl  = document.getElementById("season-open-time");
  const pickupCloseDateEl = document.getElementById("pickup-close-date");
  const pickupCloseTimeEl = document.getElementById("pickup-close-time");
  pickupOpenDateEl.value  = "前 7 天";
  pickupOpenTimeEl.value  = "20:00";
  pickupCloseDateEl.value = "前 1 天";
  pickupCloseTimeEl.value = "20:00";
  seasonOpenTimeEl.value  = "00:00";
  syncSelectPlaceholder(pickupOpenDateEl);
  syncSelectPlaceholder(pickupOpenTimeEl);
  syncSelectPlaceholder(pickupCloseDateEl);
  syncSelectPlaceholder(pickupCloseTimeEl);
  syncSelectPlaceholder(seasonOpenTimeEl);

  CalendarPicker.syncDateText();
  CalendarPicker.syncSingleDateText("season-open");
  CalendarPicker.syncSingleDateText("season-close");

  els.form.querySelectorAll("input, select").forEach((el) => {
    const target = el.closest(".money-input") || el;
    el.addEventListener("input",  () => target.classList.remove("is-error"));
    el.addEventListener("change", () => target.classList.remove("is-error"));
  });

  els.cancelButton?.addEventListener("click", () => {
    returnToPreviousPage();
  });

  els.createDialogButton?.addEventListener("click", closeCreateDialog);
  els.createDialogOverlay?.addEventListener("click", (event) => {
    if (event.target === els.createDialogOverlay) closeCreateDialog();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.createDialogOverlay?.classList.contains("is-open")) {
      closeCreateDialog();
    }
  });

  els.form.addEventListener("submit", handleCreateActivity);
}

init();
