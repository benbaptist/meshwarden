import { defineComponent, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { useNodesStore } from '../../stores/nodes.js'
import { useContactsStore } from '../../stores/contacts.js'
import { useMessagesStore } from '../../stores/messages.js'
import Sidebar from './Sidebar.js'
import BottomNav from './BottomNav.js'
import AppToast from '../shared/Toast.js'

export default defineComponent({
  name: 'AppShell',
  components: { Sidebar, BottomNav, AppToast },
  setup() {
    const auth = useAuthStore()
    const nodes = useNodesStore()
    const contacts = useContactsStore()
    const messages = useMessagesStore()
    const router = useRouter()

    onMounted(async () => {
      await auth.checkSetup()
      if (auth.accessToken) {
        const ok = await auth.restoreSession()
        if (ok) {
          nodes.fetchAll()
          nodes.bindSocket()
          contacts.fetchAll()
          contacts.bindSocket()
          messages.bindSocket()
        }
      }
    })

    return { auth }
  },
  template: `
    <div class="h-full flex dark">
      <template v-if="auth.isAuthenticated">
        <Sidebar />
        <main class="flex-1 overflow-y-auto bg-gray-950 min-w-0 pb-16 md:pb-0">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </main>
        <BottomNav class="md:hidden" />
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
