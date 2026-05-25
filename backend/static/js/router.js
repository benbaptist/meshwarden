import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth.js'

// Lazy-load views
const SetupWizard   = () => import('./views/SetupWizard.js')
const Login         = () => import('./views/Login.js')
const MapView       = () => import('./views/Map.js')
const Contacts      = () => import('./views/Contacts.js')
const ContactDetail = () => import('./views/ContactDetail.js')
const Settings      = () => import('./views/Settings.js')

const routes = [
  { path: '/setup',              component: SetupWizard,   meta: { public: true } },
  { path: '/login',              component: Login,          meta: { public: true } },
  { path: '/',                   component: MapView,        meta: { auth: true } },
  { path: '/contacts',           component: Contacts,       meta: { auth: true } },
  { path: '/contacts/:id',       component: ContactDetail,  meta: { auth: true } },
  { path: '/settings',           component: Settings,       meta: { auth: true } },
  { path: '/:pathMatch(.*)*',    redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Check setup status on first load
  if (!auth.setupChecked) {
    await auth.checkSetup()
  }

  if (!auth.setupComplete && to.path !== '/setup') {
    return '/setup'
  }

  // Validate stored token before making routing decisions
  if (auth.accessToken && !auth.user) {
    await auth.restoreSession()
  }

  if (auth.setupComplete && !auth.isAuthenticated && to.meta.auth) {
    return '/login'
  }

  if (auth.isAuthenticated && (to.path === '/login' || to.path === '/setup')) {
    return '/'
  }
})

export default router
