<script setup>
defineProps({
  date: {
    type: String,
    required: true,
  },
  weekday: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  statusLabel: {
    type: String,
    required: true,
  },
  statusValue: {
    type: String,
    required: true,
  },
  statusTone: {
    type: String,
    default: 'default',
  },
  feeAmount: {
    type: [Number, String],
    required: true,
  },
  feeState: {
    type: String,
    default: '',
  },
  feeAriaLabel: {
    type: String,
    required: true,
  },
  feeStateTone: {
    type: String,
    default: 'default',
  },
  shadowTone: {
    type: String,
    default: 'primary',
  },
  vacancyLabel: {
    type: String,
    default: '',
  },
  vacancyValue: {
    type: [Number, String],
    default: '',
  },
})
</script>

<template>
  <section class="summary-card activity-summary-card" :class="`summary-card--${shadowTone}`" aria-label="活動摘要">
    <div class="summary-main activity-summary-main">
      <div v-if="vacancyLabel" class="summary-vacancy">
        <p class="summary-vacancy-label">{{ vacancyLabel }}</p>
        <p class="summary-vacancy-value">{{ vacancyValue }}</p>
      </div>
      <div class="summary-info activity-summary-info">
        <p class="summary-time activity-summary-time">
          <span class="summary-date activity-summary-date"
            >{{ date }}<span class="summary-weekday activity-summary-weekday">（{{ weekday }}）</span></span
          >
          <span class="summary-separator activity-summary-separator">|</span>
          <span>{{ time }}</span>
        </p>
        <p class="summary-location activity-summary-location">{{ location }}</p>
      </div>
    </div>
    <div class="summary-status activity-summary-status">
      <p class="summary-status-text activity-summary-status-text">
        {{ statusLabel }}：<span class="summary-status-value" :class="`summary-status-value--${statusTone}`">{{ statusValue }}</span>
      </p>
      <div class="summary-fee activity-summary-fee" :aria-label="feeAriaLabel">
        <img class="summary-fee-money activity-summary-fee-money" src="/images/money-icon.png" alt="" aria-hidden="true" />
        <img class="summary-fee-air activity-summary-fee-air" src="/images/airconditioner-icon.png" alt="" aria-hidden="true" />
        <span class="summary-fee-amount activity-summary-fee-amount">${{ feeAmount }}</span>
        <span v-if="feeState" class="summary-fee-state activity-summary-fee-state" :class="`summary-fee-state--${feeStateTone}`">{{ feeState }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-card--primary {
  box-shadow: var(--shadow-primary-card);
}

.summary-card--muted {
  box-shadow: 2px 2px 28px rgba(143, 149, 178, 0.24);
}

.summary-vacancy {
  width: 70px;
  min-height: 70px;
  flex: 0 0 auto;
  border-radius: 9px;
  background: rgba(220, 245, 245, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  text-align: center;
}

.summary-vacancy-label {
  margin: 0;
  font-size: 13px;
  line-height: 1.25;
  font-weight: 400;
  color: #474d66;
}

.summary-vacancy-value {
  margin: 0;
  font-size: 32px;
  line-height: 1.25;
  font-weight: 700;
  color: #17acba;
}

.summary-status-value {
  font-weight: 400;
}

.summary-status-value--default {
  color: var(--muted-soft);
}

.summary-status-value--success {
  color: var(--success-500);
}

.summary-fee-state--success {
  color: var(--success-500);
}
</style>
