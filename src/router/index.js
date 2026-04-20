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

router.afterEach((to, from, failure) => {
  if (failure) return
  if (from === START_LOCATION) return

  history.replaceState({
    ...history.state, 
    __inAppFrom: from.fullPath
  }, '')
})

export default router
