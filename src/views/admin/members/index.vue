<script setup>
import { computed, onMounted, ref } from 'vue'
import PageFeedback from '~/components/PageFeedback.vue'
import { approveMember, listMembersForApproval } from '~/services/memberApprovalService'
import { useLiffStore } from '~/stores/liff'

const liffStore = useLiffStore()
const members = ref([])
const loading = ref(true)
const loadError = ref(false)
const savingId = ref(null)
const actionError = ref('')
const pendingMembers = computed(() => members.value.filter(member => !member.approved_at))
const approvedMembers = computed(() => members.value.filter(member => member.approved_at))

async function loadMembers() {
  loading.value = true
  loadError.value = false
  try {
    members.value = await listMembersForApproval(liffStore)
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function changeApproval(member) {
  if (savingId.value) return
  savingId.value = member.id
  actionError.value = ''
  try {
    const result = await approveMember(liffStore, member.id)
    member.approved_at = result.approvedAt
  } catch {
    actionError.value = '更新失敗，請稍後再試。'
  } finally {
    savingId.value = null
  }
}

onMounted(loadMembers)
</script>

<template>
  <main class="member-review-page">
    <header class="page-header">
      <h1 class="page-title">會員審核</h1>
      <p class="page-sub">確認新會員資料後，核准加入。</p>
    </header>

    <PageFeedback v-if="loading" kind="loading" message="載入中…" />
    <PageFeedback v-else-if="loadError" kind="error" message="無法載入會員資料。" @retry="loadMembers" />
    <template v-else>
      <p v-if="actionError" class="action-error" role="alert">{{ actionError }}</p>
      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" class="section-title">待審核（{{ pendingMembers.length }}）</h2>
        <p v-if="!pendingMembers.length" class="empty-copy">目前沒有待審核會員。</p>
        <div v-for="member in pendingMembers" :key="member.id" class="member-row">
          <img v-if="member.picture_url" class="member-avatar" :src="member.picture_url" alt="" />
          <div class="member-info">
            <strong>{{ member.display_name || '未命名會員' }}</strong>
            <span>{{ member.gender === 'female' ? '女' : member.gender === 'male' ? '男' : '未填性別' }}</span>
          </div>
          <button type="button" :disabled="savingId !== null || !member.gender" @click="changeApproval(member)">核准</button>
        </div>
      </section>
      <section aria-labelledby="approved-heading">
        <h2 id="approved-heading" class="section-title">已核准（{{ approvedMembers.length }}）</h2>
        <div v-for="member in approvedMembers" :key="member.id" class="member-row">
          <img v-if="member.picture_url" class="member-avatar" :src="member.picture_url" alt="" />
          <div class="member-info">
            <strong>{{ member.display_name || '未命名會員' }}</strong
            ><span>{{ member.role === 'organizer' ? '管理員' : member.role === 'engineer' ? '工程師' : '一般會員' }}</span>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.member-review-page {
  min-height: 100%;
  padding: 31px var(--page-inline-space) 40px;
  background: var(--surface);
}
.page-header {
  margin-bottom: 24px;
}
.page-title {
  margin: 0 0 4px;
  color: var(--text);
  font-size: 24px;
}
.page-sub,
.empty-copy {
  margin: 0;
  color: var(--muted-soft);
  font-size: 13px;
}
.section-title {
  margin: 24px 0 8px;
  color: var(--text);
  font-size: 16px;
}
.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  border-bottom: 1px solid var(--border-subtle);
}
.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}
.member-info {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 3px;
}
.member-info strong {
  overflow: hidden;
  color: var(--text);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.member-info span {
  color: var(--muted-soft);
  font-size: 12px;
}
.member-row button {
  min-width: 60px;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--primary-700);
  color: white;
}
.member-row button:disabled {
  opacity: 0.5;
  cursor: default;
}
.action-error {
  color: #b42318;
  font-size: 13px;
}
</style>
