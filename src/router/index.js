import { createRouter, createWebHashHistory, START_LOCATION } from 'vue-router'
import Home from '~/views/home/index.vue'
import { useLiffStore } from '~/stores/liff'

const publicRoutes = [
  {
    path: '/',
    name: 'home',
    component: Home,
  },
  {
    path: '/activities',
    name: 'activities',
    component: () => import('~/views/activities/index.vue'),
    meta: { header: 'simple' },
  },
  {
    path: '/activities/:id/:activityDateId?',
    name: 'activity',
    component: () => import('~/views/activities/[id].vue'),
  },
  {
    path: '/seasons',
    name: 'seasons',
    component: () => import('~/views/seasons/index.vue'),
    meta: { header: 'simple' },
  },
]

const adminRoutes = [
  {
    path: '/admin/activities',
    name: 'admin-activities',
    component: () => import('~/views/admin/activities/index.vue'),
    meta: { requiresOrganizer: true, header: 'simple' },
  },
  {
    path: '/admin/activities/new',
    name: 'admin-activity-create',
    component: () => import('~/views/admin/activities/form.vue'),
    meta: { requiresOrganizer: true, header: 'none' },
  },
  {
    path: '/admin/activities/:id/edit',
    name: 'admin-activity-edit',
    component: () => import('~/views/admin/activities/form.vue'),
    meta: { requiresOrganizer: true, header: 'none' },
  },
  {
    path: '/admin/seasons/refunds',
    name: 'admin-season-refunds',
    component: () => import('~/views/admin/seasons/refunds/index.vue'),
    meta: { requiresOrganizer: true, header: 'simple' },
  },
  {
    path: '/admin/seasons/refunds/:id',
    name: 'admin-season-refund',
    component: () => import('~/views/admin/seasons/refunds/[id].vue'),
    meta: { requiresOrganizer: true, header: 'simple' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: [...publicRoutes, ...adminRoutes],
})

let pendingInAppFrom = null

function getRouteFallback(path) {
  return typeof path === 'string' && path.startsWith('/') ? path : '/'
}

router.beforeEach(async (to, from) => {
  if (to.meta.requiresOrganizer) {
    const liffStore = useLiffStore()
    await liffStore.initialize()
    if (liffStore.role !== 'organizer') return { name: 'home' }
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
  if (failure || from === START_LOCATION) return

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
