<script setup>
import CreateActivityMoneyField from './CreateActivityMoneyField.vue'
import CreateActivityTimeSelect from './CreateActivityTimeSelect.vue'

defineProps({
  form: {
    type: Object,
    required: true,
  },
  selectedDates: {
    type: Array,
    required: true,
  },
  activityDatesValue: {
    type: String,
    required: true,
  },
  selectedDateText: {
    type: String,
    required: true,
  },
  selectedDateCountText: {
    type: String,
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

const emit = defineEmits(['clear-error', 'open-calendar', 'open-time-picker'])
</script>

<template>
  <section class="section" aria-labelledby="details-title">
    <h2 id="details-title" class="section-title">詳細資訊</h2>
    <input v-model="form.gameType" name="gameType" type="hidden" />

    <label class="field">
      <span class="field-label">標題</span>
      <input v-model="form.activityTitle" name="activityTitle" type="text" autocomplete="off" :class="{ 'is-error': isError('activityTitle') }" @input="emit('clear-error', 'activityTitle')" />
    </label>

    <label class="field">
      <span class="field-label">地點</span>
      <input v-model="form.location" name="location" type="text" autocomplete="off" :class="{ 'is-error': isError('location') }" @input="emit('clear-error', 'location')" />
    </label>

    <div class="field">
      <p class="field-label">日期（多選）</p>
      <button
        id="date-picker-button"
        class="control-button"
        :class="{ 'has-value': selectedDates.length > 0, 'is-error': isError('activityDates') }"
        type="button"
        @click="emit('open-calendar', 'activity')"
      >
        {{ selectedDateText }}
      </button>
      <input :value="activityDatesValue" name="activityDates" type="hidden" />
      <p v-if="selectedDates.length > 0" class="date-count-note helper-note">{{ selectedDateCountText }}</p>
    </div>

    <div class="field">
      <p class="field-label">時間</p>
      <div class="time-row">
        <CreateActivityTimeSelect
          v-model="form.activityStartTime"
          name="activityStartTime"
          placeholder="開始時間"
          :options="timeOptions"
          :has-error="isError('activityStartTime')"
          @open="emit('open-time-picker', 'activityStartTime')"
          @clear-error="emit('clear-error', 'activityStartTime')"
        />
        <span class="inline-text">至</span>
        <CreateActivityTimeSelect
          v-model="form.activityEndTime"
          name="activityEndTime"
          placeholder="結束時間"
          :options="timeOptions"
          :has-error="isError('activityEndTime')"
          @open="emit('open-time-picker', 'activityEndTime')"
          @clear-error="emit('clear-error', 'activityEndTime')"
        />
      </div>
    </div>

    <div class="field">
      <p class="field-label">單次收費</p>
      <div class="fee-grid">
        <CreateActivityMoneyField
          v-model="form.seasonSingleFee"
          id="season-single-fee"
          name="seasonSingleFee"
          label="季打"
          :has-error="isError('seasonSingleFee')"
          @clear-error="emit('clear-error', 'seasonSingleFee')"
        />
        <CreateActivityMoneyField
          v-model="form.halfYearSingleFee"
          id="half-year-single-fee"
          name="halfYearSingleFee"
          label="半年打"
          :has-error="isError('halfYearSingleFee')"
          @clear-error="emit('clear-error', 'halfYearSingleFee')"
        />
        <CreateActivityMoneyField
          v-model="form.pickupSingleFee"
          id="pickup-single-fee"
          name="pickupSingleFee"
          label="臨打"
          :has-error="isError('pickupSingleFee')"
          @clear-error="emit('clear-error', 'pickupSingleFee')"
        />
        <CreateActivityMoneyField v-model="form.acFee" id="ac-fee" name="acFee" label="冷氣" :has-error="isError('acFee')" @clear-error="emit('clear-error', 'acFee')" />
      </div>
    </div>

    <label class="field">
      <span class="field-label">單次人數</span>
      <input
        v-model="form.singleCapacity"
        name="singleCapacity"
        type="number"
        min="1"
        inputmode="numeric"
        :class="{ 'is-error': isError('singleCapacity') }"
        @input="emit('clear-error', 'singleCapacity')"
      />
    </label>
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

.helper-note {
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

.fee-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

#date-picker-button {
  font-size: 15px;
}

input.is-error,
.control-button.is-error {
  border-color: var(--danger-500);
  box-shadow: 0 0 0 3px rgba(209, 67, 67, 0.12);
}
</style>
