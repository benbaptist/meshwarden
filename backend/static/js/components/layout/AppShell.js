import { defineComponent, onMounted, watch } from 'vue'
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

    return { auth }
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
