import { defineComponent, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { useNodesStore } from '../../stores/nodes.js'

const NAV = [
  { path: '/',         label: 'Dashboard', icon: 'grid' },
  { path: '/chat',     label: 'Chat',      icon: 'chat' },
  { path: '/nodes',    label: 'Nodes',     icon: 'cpu-chip' },
  { path: '/contacts', label: 'Contacts',  icon: 'users' },
  { path: '/groups',   label: 'Groups',    icon: 'user-group' },
  { path: '/settings', label: 'Settings',  icon: 'cog' },
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
    <aside class="hidden md:flex flex-col w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 h-full">
      <!-- Logo -->
      <div class="px-5 py-5 border-b border-gray-800">
        <div class="flex items-center gap-2.5">
          <span class="text-mesh-500"><Logo :size="22" /></span>
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
          <Icon :name="item.icon" :size="18" />
          {{ item.label }}
        </router-link>
      </nav>

      <!-- User / logout -->
      <div class="px-4 py-4 border-t border-gray-800">
        <div class="text-xs text-gray-500 mb-2 truncate">{{ auth.user?.username }}</div>
        <button
          @click="auth.logout()"
          class="flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          <Icon name="logout" :size="14" />
          Sign out
        </button>
      </div>
    </aside>
  `,
})
