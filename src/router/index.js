import { createRouter, createWebHashHistory, START_LOCATION } from 'vue-router'
import ActiveActivity from '~/views/active-activity.vue'
import CreateActivity from '~/views/create-activity.vue'
import GroupList from '~/views/group-list.vue'
import Index from '~/views/index.vue'
import ManageActivities from '~/views/manage-activities.vue'
import SeasonList from '~/views/season-list.vue'
import { useLiffStore } from '~/stores/liff'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'index',
      component: Index,
    },
    {
      path: '/group-list',
      name: 'group-list',
      component: GroupList,
      meta: { header: 'simple' },
    },
    {
      path: '/season-list',
      name: 'season-list',
      component: SeasonList,
      meta: { header: 'simple' },
    },
    {
      path: '/active-activity',
      name: 'active-activity',
      component: ActiveActivity,
    },
    {
      path: '/create-activity',
      name: 'create-activity',
      component: CreateActivity,
      meta: { requiresOrganizer: true, header: 'none' },
    },
    {
      path: '/manage-activities',
      name: 'manage-activities',
      component: ManageActivities,
      meta: { requiresOrganizer: true, header: 'simple' },
    },
  ],
})

let pendingInAppFrom = null

function getRouteFallback(path) {
  return typeof path === 'string' && path.startsWith('/') ? path : '/'
}

router.beforeEach(async (to, from) => {
  if (to.meta.requiresOrganizer) {
    const liffStore = useLiffStore()
    await liffStore.initialize()
    if (liffStore.role !== 'organizer') return '/'
  }

  if (from === START_LOCATION) {
    pendingInAppFrom = null
    return
  }

  pendingInAppFrom = {
    path: from.fullPath,
    fallback: getRouteFallback(history.state?.__inAppFrom),
  }
})

router.afterEach((to, from, failure) => {
  if (failure) return
  if (from === START_LOCATION) return

  if (history.state?.__skipInAppFromUpdate) {
    const { __skipInAppFromUpdate, ...state } = history.state
    history.replaceState(state, '')
    pendingInAppFrom = null
    return
  }

  history.replaceState(
    {
      ...history.state,
      __inAppFrom: pendingInAppFrom?.path ?? from.fullPath,
      __inAppFallbackFrom: pendingInAppFrom?.fallback ?? '/',
    },
    ''
  )

  pendingInAppFrom = null
})

export default router
