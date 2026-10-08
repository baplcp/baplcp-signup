<script setup>
import { INPUT_LIMITS } from '~/config/inputLimits'
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

function getTextFieldError(value, maxLength, requiredMessage, maxLengthMessage) {
  return value.length > maxLength ? maxLengthMessage : requiredMessage
}
</script>

<template>
  <section class="section" aria-labelledby="details-title">
    <h2 id="details-title" class="section-title">詳細資訊</h2>
    <input v-model="form.gameType" name="gameType" type="hidden" />

    <label class="field">
      <span class="field-label">標題</span>
      <input
        v-model="form.activityTitle"
        name="activityTitle"
        type="text"
        autocomplete="off"
        :maxlength="INPUT_LIMITS.activityTitle"
        :class="{ 'is-error': isError('activityTitle') }"
        :aria-invalid="isError('activityTitle')"
        aria-describedby="activity-title-limit"
        @input="emit('clear-error', 'activityTitle')"
      />
      <p v-if="isError('activityTitle')" id="activity-title-limit" class="field-error" role="alert">
        {{ getTextFieldError(form.activityTitle, INPUT_LIMITS.activityTitle, '請填寫標題', `標題最多 ${INPUT_LIMITS.activityTitle} 字`) }}
      </p>
      <p v-else id="activity-title-limit" class="field-limit">最多 {{ INPUT_LIMITS.activityTitle }} 字</p>
    </label>

    <label class="field">
      <span class="field-label">地點</span>
      <input
        v-model="form.location"
        name="location"
        type="text"
        autocomplete="off"
        :maxlength="INPUT_LIMITS.activityLocation"
        :class="{ 'is-error': isError('location') }"
        :aria-invalid="isError('location')"
        aria-describedby="activity-location-limit"
        @input="emit('clear-error', 'location')"
      />
      <p v-if="isError('location')" id="activity-location-limit" class="field-error" role="alert">
        {{ getTextFieldError(form.location, INPUT_LIMITS.activityLocation, '請填寫地點', `地點最多 ${INPUT_LIMITS.activityLocation} 字`) }}
      </p>
      <p v-else id="activity-location-limit" class="field-limit">最多 {{ INPUT_LIMITS.activityLocation }} 字</p>
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
.helper-note {
  margin: 0;
  color: var(--secondary-500);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 400;
}

.fee-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

#date-picker-button {
  font-size: 15px;
}
</style>
