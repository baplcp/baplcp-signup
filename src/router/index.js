import { createRouter, createWebHashHistory, START_LOCATION } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'index',
      component: () => import('~/views/index.vue'),
    },
    {
      path: '/group-list',
      name: 'group-list',
      component: () => import('~/views/group-list.vue'),
    },
    {
      path: '/active-activity',
      name: 'active-activity',
      component: () => import('~/views/active-activity.vue'),
    },
    {
      path: '/create-activity',
      name: 'create-activity',
      component: () => import('~/views/create-activity.vue'),
    },
    {
      path: '/ended-activity',
      name: 'ended-activity',
      component: () => import('~/views/ended-activity.vue'),
    },
  ],
})

let pendingInAppFrom = null

function getRouteFallback(path) {
  return typeof path === 'string' && path.startsWith('/') ? path : '/'
}

router.beforeEach((to, from) => {
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
