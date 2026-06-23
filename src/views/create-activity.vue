<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDateLabel, useCreateActivityCalendar } from '~/composables/useCreateActivityCalendar'
import { buildActivityPayload, populateActivityForm } from '~/composables/useCreateActivityForm'
import { useCreateActivityPageForm } from '~/composables/useCreateActivityPageForm'
import { useCreateActivityTimePicker } from '~/composables/useCreateActivityTimePicker'
import { createActivity, getActivity, updateActivity } from '~/services/activityService'
import { useLiffStore } from '~/stores/liff'
import CreateActivityCalendarDialog from '../components/create-activity/CreateActivityCalendarDialog.vue'
import CreateActivityDetailsSection from '../components/create-activity/CreateActivityDetailsSection.vue'
import CreateActivityPickupSection from '../components/create-activity/CreateActivityPickupSection.vue'
import CreateActivityResultDialog from '../components/create-activity/CreateActivityResultDialog.vue'
import CreateActivitySeasonSection from '../components/create-activity/CreateActivitySeasonSection.vue'
import CreateActivityTimePickerDialog from '../components/create-activity/CreateActivityTimePickerDialog.vue'

const submitButton = ref(null)
const isSubmitting = ref(false)
const editId = ref(null)
const isPopulatingForm = ref(false)

const dialog = reactive({
  isOpen: false,
  title: '球局建立成功',
  copy: '新球局已建立完成。',
  buttonText: '確認',
  returnAfterClose: false,
})

const {
  form,
  selectedDates,
  seasonEnabled,
  isSeasonDisabledNoteAlert,
  capacityOptions,
  dayBeforeOptions,
  timeOptions,
  activityDatesValue,
  selectedDateText,
  selectedDateCountText,
  isSeasonAvailabilityDisabled,
  seasonFee,
  seasonFeeDigits,
  halfYearFee,
  halfYearFeeDigits,
  toggleSeason,
  setChoice,
  isError,
  clearError,
  validateForm,
} = useCreateActivityPageForm({ isPopulatingForm })

const {
  calendarDays,
  isCalendarOpen,
  calendarTitle,
  currentCalendarSelectedValues,
  initializeCalendar,
  setVisibleMonthFromDate,
  openCalendar,
  closeCalendar,
  changeCalendarMonth,
  selectCalendarDate,
} = useCreateActivityCalendar({ form, selectedDates, clearError })

const { isTimePickerOpen, activeTimePickerField, activeTimePickerValue, openTimePicker, closeTimePicker, commitTimePicker } = useCreateActivityTimePicker({
  form,
  clearError,
})

onMounted(async () => {
  initializeCalendar()
  await liffStore.initialize()
  if (!isOrganizer.value) {
    router.replace('/')
    return
  }

  const idParam = route.query.id
  if (idParam) {
    editId.value = idParam
    isPopulatingForm.value = true
    try {
      const data = await getActivity(idParam)
      populateActivityForm(form, data, selectedDates, seasonEnabled)

      const firstDate = selectedDates.value[0]
      if (firstDate) {
        setVisibleMonthFromDate(firstDate)
      }
    } catch (err) {
      openCreateDialog({
        title: '載入失敗',
        copy: err.message || '無法取得球局資料，請稍後再試。',
        buttonText: '確認',
        returnAfterClose: false,
      })
    } finally {
      isPopulatingForm.value = false
    }
  }
})

function returnToPreviousPage() {
  if (window.history.length > 1) window.history.back()
  else window.location.href = './group-list.html'
}

const route = useRoute()
const router = useRouter()
const liffStore = useLiffStore()
const isOrganizer = computed(() => liffStore.role === 'organizer')

const isEditMode = computed(() => !!editId.value)

function goToCreatedActivityList() {
  const inAppFrom = window.history.state?.__inAppFrom
  const inAppFallbackFrom = window.history.state?.__inAppFallbackFrom
  router.replace({
    path: '/group-list',
    state: {
      __inAppFrom: typeof inAppFrom === 'string' && inAppFrom.startsWith('/') ? inAppFrom : '/',
      __inAppFallbackFrom: typeof inAppFallbackFrom === 'string' && inAppFallbackFrom.startsWith('/') ? inAppFallbackFrom : '/',
      __skipInAppFromUpdate: true,
    },
  })
}

function openCreateDialog(options = {}) {
  dialog.title = options.title || dialog.title
  dialog.copy = options.copy || dialog.copy
  dialog.buttonText = options.buttonText || dialog.buttonText
  dialog.returnAfterClose = Boolean(options.returnAfterClose)
  dialog.isOpen = true
}

function closeCreateDialog() {
  const shouldReturn = dialog.returnAfterClose
  dialog.isOpen = false
  dialog.returnAfterClose = false
  nextTick(() => submitButton.value?.focus({ preventScroll: true }))
  if (shouldReturn) goToCreatedActivityList()
}

function validate() {
  if (!validateForm()) {
    openCreateDialog({
      title: '報名尚未完成',
      copy: '有部分必填欄位尚未填寫，請確認標示的欄位後再送出。',
      buttonText: '確認',
      returnAfterClose: false,
    })
    return false
  }

  return true
}

async function handleSubmitActivity() {
  if (!validate()) return
  const payload = buildActivityPayload(form, selectedDates, seasonEnabled, seasonFee.value, halfYearFee.value)

  isSubmitting.value = true
  try {
    if (isEditMode.value) {
      await updateActivity(liffStore, editId.value, payload)
      openCreateDialog({
        title: '設定已更新',
        copy: '球局設定已更新完成。',
        buttonText: '確認',
        returnAfterClose: true,
      })
    } else {
      await createActivity(liffStore, payload)
      openCreateDialog({
        title: '球局建立成功',
        copy: '新球局已建立完成。',
        buttonText: '確認',
        returnAfterClose: true,
      })
    }
  } catch (err) {
    openCreateDialog({
      title: isEditMode.value ? '更新失敗' : '建立失敗',
      copy: err.message || '請稍後再試',
      buttonText: '確認',
      returnAfterClose: false,
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="create-activity-page">
    <div>
      <header class="sheet-topbar">
        <button class="cancel-link" type="button" @click="returnToPreviousPage">取消</button>
      </header>

      <section class="page">
        <h1 class="page-title">{{ isEditMode ? '修改球局設定' : '建立新球局' }}</h1>

        <form id="create-activity-form" class="form-block" @submit.prevent="handleSubmitActivity">
          <CreateActivityDetailsSection
            :form="form"
            :selected-dates="selectedDates"
            :activity-dates-value="activityDatesValue"
            :selected-date-text="selectedDateText"
            :selected-date-count-text="selectedDateCountText"
            :time-options="timeOptions"
            :is-error="isError"
            @clear-error="clearError"
            @open-calendar="openCalendar"
            @open-time-picker="openTimePicker"
          />

          <div class="section-divider" aria-hidden="true"></div>

          <CreateActivitySeasonSection
            :form="form"
            :season-enabled="seasonEnabled"
            :is-season-availability-disabled="isSeasonAvailabilityDisabled"
            :is-season-disabled-note-alert="isSeasonDisabledNoteAlert"
            :season-fee="seasonFee"
            :season-fee-digits="seasonFeeDigits"
            :half-year-fee="halfYearFee"
            :half-year-fee-digits="halfYearFeeDigits"
            :capacity-options="capacityOptions"
            :time-options="timeOptions"
            :is-error="isError"
            :format-date-label="formatDateLabel"
            @clear-error="clearError"
            @open-calendar="openCalendar"
            @open-time-picker="openTimePicker"
            @set-choice="setChoice"
            @toggle-season="toggleSeason"
          />

          <div class="section-divider" aria-hidden="true"></div>

          <CreateActivityPickupSection
            :form="form"
            :day-before-options="dayBeforeOptions"
            :time-options="timeOptions"
            :is-error="isError"
            @clear-error="clearError"
            @open-time-picker="openTimePicker"
            @set-choice="setChoice"
          />
        </form>
      </section>
    </div>

    <div class="cta-fade">
      <button ref="submitButton" class="submit-button" type="submit" form="create-activity-form" :disabled="isSubmitting">
        {{ isSubmitting ? (isEditMode ? '儲存中...' : '建立中...') : isEditMode ? '儲存設定' : '建立球局' }}
      </button>
    </div>

    <CreateActivityCalendarDialog
      :open="isCalendarOpen"
      :title="calendarTitle"
      :days="calendarDays"
      :selected-values="currentCalendarSelectedValues"
      @close="closeCalendar"
      @change-month="changeCalendarMonth"
      @select-date="selectCalendarDate"
    />

    <CreateActivityTimePickerDialog :open="isTimePickerOpen" :model-value="activeTimePickerValue" :hour-only="activeTimePickerField === 'reminderTime'" @close="closeTimePicker" @commit="commitTimePicker" />

    <CreateActivityResultDialog :open="dialog.isOpen" :title="dialog.title" :copy="dialog.copy" :button-text="dialog.buttonText" @close="closeCreateDialog" />
  </main>
</template>

<style scoped>
.create-activity-page {
  height: 100%;
  background: var(--surface);
  border-radius: 24px;
  position: relative;
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
  color: var(--muted);
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

.form-block {
  display: grid;
}

.section-divider {
  height: 8px;
  margin: 22px -16px 20px;
  background: var(--section);
}

.season-area.is-collapsed + .section-divider {
  margin-top: 20px;
}

.cta-fade {
  position: sticky;
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
  background: var(--secondary-500);
  color: #fff;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
  pointer-events: auto;
}
</style>
