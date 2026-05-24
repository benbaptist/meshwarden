import { defineComponent, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { useNodesStore } from '../../stores/nodes.js'

const NAV = [
  { path: '/',         label: 'Dashboard', icon: '⊞' },
  { path: '/chat',     label: 'Chat',      icon: '💬' },
  { path: '/nodes',    label: 'Nodes',     icon: '📡' },
  { path: '/contacts', label: 'Contacts',  icon: '👥' },
  { path: '/groups',   label: 'Groups',    icon: '🗂' },
  { path: '/settings', label: 'Settings',  icon: '⚙' },
]

export default defineComponent({
  name: 'Sidebar',
  setup() {
    const route = useRoute()
    const auth = useAuthStore()
    const nodes = useNodesStore()

    const connectedCount = computed(() => nodes.nodes.filter((n) => n.connected).length)
    const totalCount = computed(() => nodes.nodes.length)

    function isActive(path) {
      if (path === '/') return route.path === '/'
      return route.path.startsWith(path)
    }

    return { NAV, auth, connectedCount, totalCount, isActive }
  },
  template: `
    <aside class="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      <!-- Logo -->
      <div class="px-5 py-5 border-b border-gray-800">
        <div class="flex items-center gap-2">
          <span class="text-mesh-500 text-xl">⬡</span>
          <span class="font-bold text-white tracking-wide text-base">MeshWarden</span>
        </div>
        <div class="mt-1.5 text-xs text-gray-500">
          {{ connectedCount }}/{{ totalCount }} nodes online
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 py-3 overflow-y-auto scrollbar-thin">
        <router-link
          v-for="item in NAV"
          :key="item.path"
          :to="item.path"
          :class="[
            'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors',
            isActive(item.path)
              ? 'bg-mesh-900/60 text-mesh-400 font-medium'
              : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
          ]"
        >
          <span class="text-base w-5 text-center">{{ item.icon }}</span>
          {{ item.label }}
        </router-link>
      </nav>

      <!-- User / logout -->
      <div class="px-4 py-4 border-t border-gray-800">
        <div class="text-xs text-gray-500 mb-2 truncate">{{ auth.user?.username }}</div>
        <button
          @click="auth.logout()"
          class="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >Sign out</button>
      </div>
    </aside>
  `,
})
