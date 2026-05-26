import { defineComponent, onMounted, onUnmounted, watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { useNodesStore } from '../../stores/nodes.js'
import { useContactsStore } from '../../stores/contacts.js'
import { useMessagesStore } from '../../stores/messages.js'
import Sidebar from './Sidebar.js'
import BottomNav from './BottomNav.js'
import NodeSwitcher from './NodeSwitcher.js'
import AppToast from '../shared/Toast.js'

export default defineComponent({
  name: 'AppShell',
  components: { Sidebar, BottomNav, NodeSwitcher, AppToast },
  setup() {
    const auth = useAuthStore()
    const nodes = useNodesStore()
    const contacts = useContactsStore()
    const messages = useMessagesStore()
    const router = useRouter()

    let storesInitialized = false
    function initStores() {
      if (storesInitialized) return
      storesInitialized = true
      nodes.fetchAll()
      nodes.bindSocket()
      contacts.fetchAll()
      contacts.bindSocket()
      messages.bindSocket()
    }

    onMounted(() => { if (auth.isAuthenticated) initStores() })
    watch(() => auth.isAuthenticated, (val) => { if (val) initStores() })

    const showLoading = ref(false)
    const navError = ref(null)
    let loadingTimer = null

    const removeBeforeEach = router.beforeEach((to) => {
      if (!to.meta.auth) return
      navError.value = null
      clearTimeout(loadingTimer)
      showLoading.value = false
      loadingTimer = setTimeout(() => { showLoading.value = true }, 500)
    })

    const removeAfterEach = router.afterEach(() => {
      clearTimeout(loadingTimer)
      showLoading.value = false
    })

    const removeOnError = router.onError((err) => {
      clearTimeout(loadingTimer)
      showLoading.value = false
      navError.value = err.message || 'Failed to load page'
    })

    function retryNav() {
      navError.value = null
      router.replace(router.currentRoute.value.fullPath)
    }

    onUnmounted(() => {
      removeBeforeEach()
      removeAfterEach()
      removeOnError()
      clearTimeout(loadingTimer)
    })

    return { auth, showLoading, navError, retryNav }
  },
  template: `
    <div class="h-full flex flex-col dark app-bg">
      <template v-if="auth.isAuthenticated">
        <!-- Mobile-only header -->
        <header
          class="md:hidden flex-shrink-0 flex items-center gap-3 px-4 h-12 border-b border-white/[0.06] z-10"
          style="background: rgba(9,9,15,0.85); backdrop-filter: blur(20px);"
        >
          <span class="text-violet-400"><Logo :size="18" /></span>
          <span class="font-bold text-white text-sm tracking-wide flex-1">MeshWarden</span>
          <NodeSwitcher :compact="true" />
        </header>

        <!-- Sidebar (desktop) + main content -->
        <div class="flex flex-1 min-h-0">
          <Sidebar class="hidden md:flex" />
          <main class="flex-1 overflow-y-auto min-w-0 relative">
            <router-view />
            <div
              v-if="showLoading"
              class="absolute inset-0 flex items-center justify-center z-50"
              style="background: rgba(9,9,15,0.8); backdrop-filter: blur(8px);"
            >
              <Spinner size="lg" />
            </div>
            <div
              v-if="navError"
              class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 z-50"
              style="background: rgba(9,9,15,0.95);"
            >
              <Icon name="warning" :size="40" class="text-rose-400" />
              <div class="text-zinc-300 font-semibold text-center">Failed to load page</div>
              <div class="text-zinc-500 text-sm text-center">{{ navError }}</div>
              <button
                @click="retryNav"
                class="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
              >Retry</button>
            </div>
          </main>
        </div>

        <!-- Mobile-only bottom nav -->
        <BottomNav class="md:hidden flex-shrink-0" />
      </template>

      <template v-else>
        <div class="flex-1">
          <router-view />
        </div>
      </template>

      <AppToast />
    </div>
  `,
})
