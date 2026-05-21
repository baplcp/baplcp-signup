<script setup>
import CreateActivityChoiceCard from './CreateActivityChoiceCard.vue'
import CreateActivityTimeSelect from './CreateActivityTimeSelect.vue'

const props = defineProps({
  form: {
    type: Object,
    required: true,
  },
  seasonEnabled: {
    type: Boolean,
    required: true,
  },
  isSeasonAvailabilityDisabled: {
    type: Boolean,
    required: true,
  },
  isSeasonDisabledNoteAlert: {
    type: Boolean,
    required: true,
  },
  seasonFee: {
    type: String,
    required: true,
  },
  seasonFeeDigits: {
    type: Number,
    required: true,
  },
  capacityOptions: {
    type: Array,
    required: true,
  },
  timeOptions: {
    type: Array,
    required: true,
  },
  isError: {
    type: Function,
    required: true,
  },
  formatDateLabel: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits(['clear-error', 'open-calendar', 'open-time-picker', 'set-choice', 'toggle-season'])

function isChoiceActive(field, value) {
  return props.form[field] === value
}

function isChoiceCondensed(field) {
  return props.form[field] === 'unlimited'
}

function openSeasonCloseCalendar() {
  emit('set-choice', 'seasonDeadlineType', 'custom')
  emit('open-calendar', 'season-close')
}

function openSeasonCloseTimePicker() {
  emit('set-choice', 'seasonDeadlineType', 'custom')
  emit('open-time-picker', 'seasonCloseTime')
}
</script>

<template>
  <section class="section season-area" :class="{ 'is-collapsed': !seasonEnabled }" aria-labelledby="season-title">
    <div class="section-header">
      <div>
        <h2 id="season-title" class="section-title">季打報名開放</h2>
        <p v-if="isSeasonAvailabilityDisabled" class="section-note" :class="{ 'is-alert': isSeasonDisabledNoteAlert }">球局次數需 4 次以上</p>
      </div>
      <button
        class="switch"
        :class="{ 'is-on': seasonEnabled, 'is-disabled': isSeasonAvailabilityDisabled }"
        type="button"
        role="switch"
        :aria-checked="String(seasonEnabled)"
        :aria-disabled="String(isSeasonAvailabilityDisabled)"
        aria-label="季打報名開放"
        @click="emit('toggle-season')"
      ></button>
    </div>

    <div class="field-list season-fields" :class="{ 'is-collapsed': !seasonEnabled }">
      <div class="field">
        <p class="field-label"><strong>季打費用</strong></p>
        <div class="fee-card">
          <label class="fee-check-row">
            <input id="season-include-ac" v-model="form.seasonIncludeAc" name="seasonIncludeAc" type="checkbox" hidden />
            <span class="fee-check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5L9.5 17L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span>含冷氣費</span>
          </label>
          <label class="fee-input-row">
            <span>$</span>
            <input
              id="season-fee"
              :value="seasonFee"
              name="seasonFee"
              type="text"
              inputmode="numeric"
              aria-label="季打費用"
              placeholder=" "
              readonly
              :style="{ '--season-fee-digits': seasonFeeDigits }"
            />
            <span class="fee-unit">/人</span>
          </label>
        </div>
        <p class="auto-note fee-note">*自動填入</p>
      </div>

      <label class="field">
        <span class="field-label">季打名額</span>
        <span class="select-wrap">
          <select
            id="season-capacity"
            v-model="form.seasonCapacity"
            name="seasonCapacity"
            :class="{ 'is-placeholder': form.seasonCapacity === '', 'is-error': isError('seasonCapacity') }"
            @change="emit('clear-error', 'seasonCapacity')"
          >
            <option value="">請選擇人數</option>
            <option v-for="option in capacityOptions" :key="`season-capacity-${option}`" :value="option">{{ option === 'unlimited' ? '不限' : option }}</option>
          </select>
        </span>
      </label>

      <div class="field">
        <p class="field-label">季打開放報名時間</p>
        <div class="time-row">
          <button
            id="season-open-date-button"
            class="control-button"
            :class="{ 'has-value': form.seasonOpenDate, 'is-error': isError('seasonOpenDate') }"
            type="button"
            @click="emit('open-calendar', 'season-open')"
          >
            {{ form.seasonOpenDate ? formatDateLabel(form.seasonOpenDate) : '請選擇日期' }}
          </button>
          <input v-model="form.seasonOpenDate" name="seasonOpenDate" type="hidden" />
          <span class="inline-text">的</span>
          <CreateActivityTimeSelect
            id="season-open-time"
            v-model="form.seasonOpenTime"
            name="seasonOpenTime"
            placeholder="幾點"
            :options="timeOptions"
            :has-error="isError('seasonOpenTime')"
            @open="emit('open-time-picker', 'seasonOpenTime')"
            @clear-error="emit('clear-error', 'seasonOpenTime')"
          />
        </div>
      </div>

      <div class="field">
        <p class="field-label"><strong>季打截止時間</strong></p>
        <div class="choice-stack">
          <CreateActivityChoiceCard
            :active="isChoiceActive('seasonDeadlineType', 'unlimited')"
            :condensed="isChoiceCondensed('seasonDeadlineType')"
            title="不限時間"
            copy="管理員可手動關閉"
            @select="emit('set-choice', 'seasonDeadlineType', 'unlimited')"
          />
          <CreateActivityChoiceCard
            :active="isChoiceActive('seasonDeadlineType', 'custom')"
            :condensed="isChoiceCondensed('seasonDeadlineType')"
            title="設定截止時間"
            @select="emit('set-choice', 'seasonDeadlineType', 'custom')"
          >
            <span class="choice-rule is-date-time">
              <button
                id="season-close-date-button"
                class="control-button"
                :class="{ 'has-value': form.seasonCloseDate, 'is-error': isError('seasonCloseDate') }"
                type="button"
                @click.stop="openSeasonCloseCalendar"
              >
                {{ form.seasonCloseDate ? formatDateLabel(form.seasonCloseDate) : '請選擇日期' }}
              </button>
              <input v-model="form.seasonCloseDate" name="seasonCloseDate" type="hidden" />
              <span>的</span>
              <CreateActivityTimeSelect
                id="season-close-time"
                v-model="form.seasonCloseTime"
                name="seasonCloseTime"
                placeholder="幾點"
                :options="timeOptions"
                :has-error="isError('seasonCloseTime')"
                @open="openSeasonCloseTimePicker"
                @clear-error="emit('clear-error', 'seasonCloseTime')"
              />
            </span>
          </CreateActivityChoiceCard>
        </div>
        <input v-model="form.seasonDeadlineType" name="seasonDeadlineType" type="hidden" />
      </div>
    </div>
  </section>
</template>

<style scoped>
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
  color: var(--muted);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 400;
}

.section-note.is-alert {
  color: #d14343;
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
  border: 1px solid var(--neutral-300);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  color: var(--muted);
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

.auto-note {
  margin: 0;
  color: var(--secondary-500);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 400;
}

.time-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
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

.fee-card {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--neutral-300);
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
  background: var(--secondary-500);
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

.choice-stack {
  display: grid;
  gap: 12px;
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

.choice-rule select {
  font-size: 15px;
}

.choice-rule.is-date-time {
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

#season-capacity,
#season-open-date-button,
#season-close-date-button {
  font-size: 15px;
}

select.is-error,
.control-button.is-error {
  border-color: var(--danger-500);
  box-shadow: 0 0 0 3px rgba(209, 67, 67, 0.12);
}
</style>
