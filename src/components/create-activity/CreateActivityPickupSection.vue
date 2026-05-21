<script setup>
import CreateActivityChoiceCard from './CreateActivityChoiceCard.vue'
import CreateActivityTimeSelect from './CreateActivityTimeSelect.vue'

const props = defineProps({
  form: {
    type: Object,
    required: true,
  },
  dayBeforeOptions: {
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
})

const emit = defineEmits(['clear-error', 'open-time-picker', 'set-choice'])

function isChoiceActive(field, value) {
  return props.form[field] === value
}

function isChoiceCondensed(field) {
  return props.form[field] === 'unlimited'
}

function openPickupCloseTimePicker() {
  emit('set-choice', 'deadlineType', 'custom')
  emit('open-time-picker', 'pickupCloseTime')
}

function openReminderTimePicker() {
  emit('set-choice', 'reminderEnabled', 'enabled')
  emit('open-time-picker', 'reminderTime')
}
</script>

<template>
  <section class="section" aria-labelledby="pickup-title">
    <h2 id="pickup-title" class="section-title">臨打報名</h2>

    <label class="field">
      <span class="field-label">通知標題</span>
      <input v-model="form.pickupLabel" name="pickupLabel" type="text" autocomplete="off" placeholder="例：週日臨打報名" />
    </label>

    <div class="field">
      <p class="field-label">開放時間</p>
      <div class="time-row is-rule">
        <span class="inline-text">每次活動</span>
        <span class="select-wrap">
          <select
            v-model="form.pickupOpenDate"
            name="pickupOpenDate"
            :class="{ 'is-placeholder': form.pickupOpenDate === '', 'is-error': isError('pickupOpenDate') }"
            @change="emit('clear-error', 'pickupOpenDate')"
          >
            <option value="">幾天前</option>
            <option v-for="option in dayBeforeOptions" :key="`pickup-open-date-${option}`" :value="option">{{ option }}</option>
          </select>
        </span>
        <span class="inline-text">的</span>
        <CreateActivityTimeSelect
          v-model="form.pickupOpenTime"
          name="pickupOpenTime"
          placeholder="幾點"
          :options="timeOptions"
          :has-error="isError('pickupOpenTime')"
          @open="emit('open-time-picker', 'pickupOpenTime')"
          @clear-error="emit('clear-error', 'pickupOpenTime')"
        />
      </div>
    </div>

    <div class="field">
      <p class="field-label"><strong>截止時間</strong></p>
      <div class="choice-stack">
        <CreateActivityChoiceCard
          :active="isChoiceActive('deadlineType', 'unlimited')"
          :condensed="isChoiceCondensed('deadlineType')"
          title="不限時間"
          copy="活動開始前皆可報名"
          @select="emit('set-choice', 'deadlineType', 'unlimited')"
        />
        <CreateActivityChoiceCard
          :active="isChoiceActive('deadlineType', 'custom')"
          :condensed="isChoiceCondensed('deadlineType')"
          title="設定截止時間"
          @select="emit('set-choice', 'deadlineType', 'custom')"
        >
          <span class="choice-rule">
            <span>每次活動</span>
            <span class="select-wrap" @click.stop="emit('set-choice', 'deadlineType', 'custom')">
              <select
                v-model="form.pickupCloseDate"
                name="pickupCloseDate"
                :class="{ 'is-placeholder': form.pickupCloseDate === '', 'is-error': isError('pickupCloseDate') }"
                @change="emit('clear-error', 'pickupCloseDate')"
              >
                <option value="">幾天前</option>
                <option v-for="option in dayBeforeOptions" :key="`pickup-close-date-${option}`" :value="option">{{ option }}</option>
              </select>
            </span>
            <span>的</span>
            <CreateActivityTimeSelect
              v-model="form.pickupCloseTime"
              name="pickupCloseTime"
              placeholder="幾點"
              :options="timeOptions"
              :has-error="isError('pickupCloseTime')"
              @open="openPickupCloseTimePicker"
              @clear-error="emit('clear-error', 'pickupCloseTime')"
            />
          </span>
        </CreateActivityChoiceCard>
      </div>
      <input v-model="form.deadlineType" name="deadlineType" type="hidden" />
    </div>

    <div class="field">
      <p class="field-label">活動前提醒</p>
      <div class="choice-stack">
        <CreateActivityChoiceCard
          :active="isChoiceActive('reminderEnabled', 'disabled')"
          :condensed="form.reminderEnabled === 'disabled'"
          title="不提醒"
          copy="活動前不發送報名成功提醒"
          @select="emit('set-choice', 'reminderEnabled', 'disabled')"
        />
        <CreateActivityChoiceCard :active="isChoiceActive('reminderEnabled', 'enabled')" :condensed="false" title="發送提醒" @select="emit('set-choice', 'reminderEnabled', 'enabled')">
          <span class="choice-rule">
            <span>每次活動</span>
            <span class="select-wrap" @click.stop="emit('set-choice', 'reminderEnabled', 'enabled')">
              <select
                v-model="form.reminderDaysBefore"
                name="reminderDaysBefore"
                :class="{ 'is-placeholder': form.reminderDaysBefore === '', 'is-error': isError('reminderDaysBefore') }"
                @change="emit('clear-error', 'reminderDaysBefore')"
              >
                <option value="">幾天前</option>
                <option value="前 0 天">當天（前 0 天）</option>
                <option v-for="option in dayBeforeOptions" :key="`reminder-date-${option}`" :value="option">{{ option }}</option>
              </select>
            </span>
            <span>的</span>
            <CreateActivityTimeSelect
              v-model="form.reminderTime"
              name="reminderTime"
              placeholder="幾點"
              :options="timeOptions"
              :has-error="isError('reminderTime')"
              @open="openReminderTimePicker"
              @clear-error="emit('clear-error', 'reminderTime')"
            />
            <span>發送</span>
          </span>
        </CreateActivityChoiceCard>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section,
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

.time-row.is-rule select,
.choice-rule select {
  font-size: 15px;
}

select.is-error {
  border-color: var(--danger-500);
  box-shadow: 0 0 0 3px rgba(209, 67, 67, 0.12);
}
</style>
