<script setup>
import ActivityAllDatesDialog from '~/components/activity/ActivityAllDatesDialog.vue'
import ActivityMemberSection from '~/components/activity/ActivityMemberSection.vue'
import ActivityMemberSubList from '~/components/activity/ActivityMemberSubList.vue'
import ActivitySeasonPlanSheet from '~/components/activity/ActivitySeasonPlanSheet.vue'
import ActivitySignupSheet from '~/components/activity/ActivitySignupSheet.vue'
import ActivitySummaryCard from '~/components/activity/ActivitySummaryCard.vue'
import { useActiveActivityPage } from '~/composables/useActiveActivityPage'

const { navigation, activity, summary, members, signup, dialogs, admin, elementRefs, actions } = useActiveActivityPage()
const { router } = navigation
</script>

<template>
  <div v-if="activity.activityNotFound" class="not-found-page">
    <div class="not-found-content">
      <p class="not-found-icon" aria-hidden="true">🏐</p>
      <h1 class="not-found-title">此球局已被移除</h1>
      <p class="not-found-desc">你開啟的球局連結已不存在，可能已被主揪刪除。</p>
      <button class="not-found-btn" type="button" @click="router.replace('/')">回到首頁</button>
    </div>
  </div>

  <main v-else class="active-activity-page" :class="activity.pageClasses" @keydown.esc="actions.handleEscape">
    <Teleport v-if="admin.isAdmin" to="#nav-extra">
      <button class="admin-mode-toggle" :class="{ 'is-active': admin.adminMode }" type="button" :aria-pressed="String(admin.adminMode)" @click="admin.adminMode = !admin.adminMode">
        <span class="admin-mode-dot"></span>
        管理
      </button>
    </Teleport>
    <section class="hero">
      <img v-if="activity.showHeroCat" class="hero-cat" src="/images/cat-hide.png" alt="" aria-hidden="true" />
      <div class="hero-layout">
        <div class="hero-copy">
          <h1>{{ activity.heroTitle }}</h1>
        </div>
      </div>
    </section>

    <ActivitySummaryCard
      v-bind="summary.summaryCardProps"
      :is-loading="activity.isLoading"
      :is-admin="admin.isAdmin"
      :ac-enabled="admin.acEnabled"
      @update:ac-enabled="actions.updateAcEnabled"
      @view-dates="dialogs.showAllDatesDialog = true"
    />

    <ActivityMemberSection
      :tabs="members.segmentTabs"
      :active-segment="members.activeSegment"
      :members="members.filteredMemberList"
      :bottom-spacing="members.memberBottomSpacing"
      :is-admin="admin.isAdmin"
      :admin-mode="admin.adminMode"
      :ac-enabled="admin.acEnabled"
      :ac-fee="admin.acFeePerSession"
      @change="actions.setSegmentTab"
      @remove="actions.handleRemoveRequest"
      @toggle-payment="actions.togglePayment"
    />
    <div v-if="activity.isLoading && members.filteredMemberList.length === 0" class="member-skeleton" aria-hidden="true">
      <div v-for="i in 7" :key="i" class="member-skeleton-row">
        <div class="skel skel-rank"></div>
        <div class="skel skel-avatar"></div>
        <div class="skel-text">
          <div class="skel skel-name"></div>
          <div class="skel skel-time"></div>
        </div>
      </div>
    </div>
    <p v-else-if="!activity.isLoading && members.filteredMemberList.length === 0" class="empty-member-hint">目前尚無報名資料</p>

    <ActivityMemberSubList v-if="members.showCancelledMemberList" :label="members.cancelledMemberListLabel" :members="members.cancelledMemberList" />

    <ActivityMemberSubList v-if="members.showLeaveMemberList" label="已請假" :members="members.leaveMemberList" :show-meta="false" />

    <div class="page-end-pad"></div>

    <div v-if="signup.showFooterCta" class="footer-bar">
      <div class="footer-fade"></div>
      <button
        :ref="elementRefs.heroCtaButton"
        class="cta"
        :class="{ 'cta-disabled': signup.ctaDisabled }"
        type="button"
        :disabled="signup.isSubmitting || signup.ctaDisabled"
        @click="actions.handleCtaClick"
      >
        {{ signup.ctaLabel }}
      </button>
    </div>

    <ActivitySignupSheet
      :ref="elementRefs.signupSheetRef"
      :open="signup.signupOpen"
      :is-season-leave-mode="signup.isSeasonLeaveMode"
      :signup-state="signup.signupState"
      :signup-total="signup.signupTotal"
      :is-registration-open="signup.isRegistrationOpen"
      :is-submitting="signup.isSubmitting"
      :is-signup-changed="signup.isSignupChanged"
      :registration-countdown="signup.registrationCountdown"
      :show-guest-validation="signup.showGuestValidation"
      :is-admin="admin.isAdmin"
      @close="actions.setSignupOpen(false)"
      @adjust-count="actions.adjustSignupCount"
      @submit="actions.submitSignup"
    />

    <div
      class="success-dialog-overlay shared-dialog-overlay"
      :class="{ 'is-open': dialogs.successDialog.open }"
      :aria-hidden="String(!dialogs.successDialog.open)"
      :inert="!dialogs.successDialog.open"
    >
      <section class="success-dialog shared-dialog" role="dialog" aria-modal="true" aria-labelledby="success-dialog-title">
        <h2 class="success-dialog-title shared-dialog-title" id="success-dialog-title">{{ dialogs.successDialog.title }}</h2>
        <p class="success-dialog-copy shared-dialog-copy">{{ dialogs.successDialog.copy }}</p>
        <button :ref="elementRefs.successDialogButton" class="success-dialog-button shared-dialog-button" type="button" @click="actions.handleDialogButtonClick">
          {{ dialogs.successDialog.buttonText }}
        </button>
      </section>
    </div>

    <div class="remove-dialog-overlay shared-dialog-overlay" :class="{ 'is-open': dialogs.removeDialog.open }" :aria-hidden="String(!dialogs.removeDialog.open)" :inert="!dialogs.removeDialog.open">
      <button class="remove-dialog-backdrop" type="button" aria-label="取消移除" @click="actions.cancelRemove"></button>
      <section class="remove-dialog shared-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-dialog-title">
        <h2 class="remove-dialog-title shared-dialog-title" id="remove-dialog-title">確認移除成員？</h2>
        <p class="remove-dialog-copy shared-dialog-copy">確定要將「{{ dialogs.removeDialog.member?.name }}」從名單中移除嗎？此操作無法復原。</p>
        <div class="remove-dialog-actions">
          <button type="button" class="remove-dialog-cancel" @click="actions.cancelRemove">取消</button>
          <button :ref="elementRefs.removeConfirmButton" type="button" class="remove-dialog-confirm" @click="actions.confirmRemove">確認移除</button>
        </div>
      </section>
    </div>

    <ActivitySeasonPlanSheet
      :open="dialogs.seasonPlanOpen"
      :quarter-count="dialogs.seasonPlanData.quarterCount"
      :quarter-date-range="dialogs.seasonPlanData.quarterDateRange"
      :quarter-total="dialogs.seasonPlanData.quarterTotal"
      :quarter-fee-per-session="dialogs.seasonPlanData.quarterFeePerSession"
      :half-year-count="dialogs.seasonPlanData.halfYearCount"
      :half-year-date-range="dialogs.seasonPlanData.halfYearDateRange"
      :half-year-total="dialogs.seasonPlanData.halfYearTotal"
      :half-year-fee-per-session="dialogs.seasonPlanData.halfYearFeePerSession"
      @close="dialogs.seasonPlanOpen = false"
      @confirm="actions.handleSeasonPlanConfirm"
    />

    <!-- 取消季打報名確認 sheet -->
    <div
      class="season-cancel-overlay phone-container modal-frame"
      :class="{ 'is-open': dialogs.seasonCancelOpen }"
      :aria-hidden="String(!dialogs.seasonCancelOpen)"
      :inert="!dialogs.seasonCancelOpen"
      @click.self="dialogs.seasonCancelOpen = false"
    >
      <section class="season-cancel-sheet" role="dialog" aria-modal="true">
        <p class="season-cancel-title">確認取消季打報名？</p>
        <p class="season-cancel-copy">取消後你將從季打名單中移除，名額將釋出給其他人。</p>
        <div class="season-cancel-actions">
          <button class="season-cancel-btn is-muted" type="button" @click="dialogs.seasonCancelOpen = false">保留報名</button>
          <button class="season-cancel-btn is-danger" type="button" @click="actions.confirmSeasonCancel">確認取消</button>
        </div>
      </section>
    </div>

    <ActivityAllDatesDialog :open="dialogs.showAllDatesDialog" :dates="summary.activityDates" :session-count="summary.activitySessionCount" :quarter-count="summary.seasonQuarterSessionCount" @close="dialogs.showAllDatesDialog = false" />
  </main>
</template>

<style scoped>
.active-activity-page {
  height: 100%;
  background: linear-gradient(180deg, #5768ff 0%, #6373ff 7%, #7d8af9 13%, #c1c6f1 20%, #e8e9f5 27%, #fff 35%, #fff 100%);
}

.active-activity-page.hero-upcoming {
  background: linear-gradient(180deg, #1bc4bf 0%, #22cec9 7%, #3dd5d0 13%, #a8ebe9 20%, #ddf5f4 27%, #fff 35%, #fff 100%);
}

.active-activity-page.hero-ended {
  background: linear-gradient(180deg, #7b82a8 0%, #8b91b8 7%, #9ea4c6 13%, #c9cbd8 20%, #e6e6ef 27%, #fff 35%, #fff 100%);
}

.active-activity-page.hero-season {
  background: linear-gradient(180deg, #c87416 0%, #d4820f 7%, #e09a3a 13%, #f0bf78 20%, #fae1b8 27%, #fff 35%, #fff 100%);
}

.hero {
  position: relative;
  background: transparent;
  padding: 78px 16px 92px;
  min-height: 219px;
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: none;
  pointer-events: none;
}

.hero-layout {
  position: relative;
  z-index: 1;
}

.hero-cat {
  position: absolute;
  right: 18px;
  bottom: 52px;
  width: 158px;
  height: auto;
  z-index: 1;
  pointer-events: none;
}

.hero-copy {
  position: relative;
  z-index: 2;
  color: #fff;
  padding-top: 0;
  transform: none;
  text-align: left;
}

.hero-copy h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.36;
  font-weight: 700;
  letter-spacing: 0.56px;
}

.leave-button {
  min-width: 0;
  min-height: 0;
  padding: 7px 14px;
  border: 1px solid #e3e6ef;
  border-radius: 999px;
  background: #fff;
  color: #474d66;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 400;
}

.page-end-pad {
  height: 100px;
}

.footer-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 24.375rem;
  z-index: 15;
  padding: 0 16px 16px;
  background: transparent;
}

.footer-fade {
  position: absolute;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #fff 50%, #fff 100%);
  bottom: 0;
  left: 0;
  width: 100%;
  height: 154px;
}

.cta {
  position: relative;
  z-index: 10;
  width: 100%;
  min-height: 57px;
  border-radius: 12px;
  background: #1bc4bf;
  color: #fff;
  font-size: 17px;
  font-weight: 500;
  box-shadow: none;
}

.cta-disabled {
  background: #d8dae5;
  color: #8f95b2;
  cursor: default;
}

.success-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
}

.remove-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
}

.remove-dialog-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.remove-dialog {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  max-width: 340px;
  margin: auto;
  padding: 28px 24px 24px;
  border-radius: 16px;
  background: #fff;
}

.remove-dialog-title {
  color: #d14343;
}

.remove-dialog-copy {
  margin: 10px 0 0;
  color: #474d66;
  font-size: 14px;
  line-height: 1.6;
}

.remove-dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 24px;
}

.remove-dialog-cancel {
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid #d8dae5;
  background: #fff;
  color: #474d66;
  font-size: 15px;
  font-weight: 500;
}

.remove-dialog-confirm {
  min-height: 44px;
  border-radius: 10px;
  background: #d14343;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.empty-member-hint {
  padding: 0 16px 80px;
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
  color: #8f95b2;
}

.member-skeleton {
  padding: 0 16px 100px;
  display: flex;
  flex-direction: column;
}

.member-skeleton-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
}

.skel-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skel {
  border-radius: 6px;
  background: linear-gradient(90deg, #eef0f6 25%, #e4e6ef 50%, #eef0f6 75%);
  background-size: 200% 100%;
  animation: skel-shimmer 1.4s ease infinite;
}

.skel-rank {
  width: 18px;
  height: 14px;
  flex: 0 0 auto;
  border-radius: 4px;
}

.skel-avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.skel-name {
  height: 14px;
  width: 55%;
}

.skel-time {
  height: 12px;
  width: 35%;
}

@keyframes skel-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.not-found-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #e8e9f5 0%, #fff 40%, #fff 100%);
  padding: 32px 24px;
}

.not-found-content {
  text-align: center;
  max-width: 280px;
}

.not-found-icon {
  font-size: 52px;
  margin: 0 0 20px;
  line-height: 1;
}

.not-found-title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 700;
  color: #101840;
  line-height: 1.4;
}

.not-found-desc {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.6;
  color: #696f8c;
}

.not-found-btn {
  width: 100%;
  min-height: 48px;
  border-radius: 12px;
  background: #5768ff;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.season-cancel-overlay {
  position: fixed;
  z-index: 10002;
  overflow: hidden;
  margin: auto;
  display: none;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.4);
}

.season-cancel-overlay.is-open {
  display: flex;
}

.season-cancel-sheet {
  width: 100%;
  padding: 28px 20px 24px;
  border-radius: 18px 18px 0 0;
  background: #fff;
}

.season-cancel-title {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
  color: #101840;
  line-height: 1.36;
}

.season-cancel-copy {
  margin: 0 0 24px;
  font-size: 14px;
  color: #474d66;
  line-height: 1.6;
}

.season-cancel-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.season-cancel-btn {
  min-height: 48px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
}

.season-cancel-btn.is-muted {
  background: #f4f6fa;
  color: #474d66;
}

.season-cancel-btn.is-danger {
  background: #d14343;
  color: #fff;
}

@media (min-width: 768px) {
  .footer-bar {
    bottom: 24px;
    border-radius: 0 0 1.5rem 1.5rem;
    overflow: hidden;
  }
}
</style>

<style>
.admin-mode-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  border: 1.5px solid rgba(255, 255, 255, 0.45);
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.admin-mode-toggle.is-active {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.9);
  color: #fff;
}

.admin-mode-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  flex: 0 0 auto;
  transition: background 0.2s ease;
}

.admin-mode-toggle.is-active .admin-mode-dot {
  background: #1bc4bf;
}

.nav.is-scrolled .admin-mode-toggle {
  border-color: rgba(87, 104, 255, 0.35);
  color: #5768ff;
}

.nav.is-scrolled .admin-mode-toggle.is-active {
  background: rgba(87, 104, 255, 0.08);
  border-color: rgba(87, 104, 255, 0.6);
  color: #5768ff;
}

.nav.is-scrolled .admin-mode-dot {
  background: rgba(87, 104, 255, 0.3);
}

.nav.is-scrolled .admin-mode-toggle.is-active .admin-mode-dot {
  background: #1bc4bf;
}
</style>
