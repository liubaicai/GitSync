import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/Dashboard.vue'),
    },
    {
      path: '/sources',
      name: 'sources',
      component: () => import('@/views/SourceManage.vue'),
    },
    {
      path: '/ssh-keys',
      name: 'ssh-keys',
      component: () => import('@/views/SSHKeyManage.vue'),
    },
  ],
})

export default router
