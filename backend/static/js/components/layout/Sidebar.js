import { defineComponent, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { useMessagesStore } from '../../stores/messages.js'
import NodeSwitcher from './NodeSwitcher.js'

const NAV = [
  { path: '/',          label: 'Map',      icon: 'map' },
  { path: '/contacts',  label: 'Contacts', icon: 'users' },
  { path: '/channels',  label: 'Channels', icon: 'hashtag' },
  { path: '/settings',  label: 'Settings', icon: 'cog' },
]

export default defineComponent({
  name: 'Sidebar',
  components: { NodeSwitcher },
  setup() {
    const route = useRoute()
    const auth = useAuthStore()
    const messages = useMessagesStore()

    const totalUnread = computed(() =>
      Object.values(messages.unreadCounts).reduce((s, n) => s + n, 0)
    )

    function isActive(path) {
      if (path === '/') return route.path === '/'
      return route.path.startsWith(path)
    }

    return { NAV, auth, isActive, totalUnread }
  },
  template: `
    <aside
      class="flex flex-col w-56 flex-shrink-0 h-full border-r border-white/[0.06]"
      style="background: rgba(9,9,15,0.7); backdrop-filter: blur(20px);"
    >
      <!-- Logo + node switcher -->
      <div class="px-4 py-5 border-b border-white/[0.06] space-y-3">
        <div class="flex items-center gap-2.5">
          <span class="text-violet-400"><Logo :size="20" /></span>
          <span class="font-bold text-white tracking-wide text-sm">MeshWarden</span>
        </div>
        <NodeSwitcher />
      </div>

      <!-- Nav -->
      <nav class="flex-1 py-3 overflow-y-auto scrollbar-thin space-y-0.5">
        <router-link
          v-for="item in NAV"
          :key="item.path"
          :to="item.path"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl text-sm transition-all duration-150',
            isActive(item.path)
              ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] border border-transparent'
          ]"
        >
          <Icon :name="item.icon" :size="17" />
          <span class="flex-1">{{ item.label }}</span>
          <span
            v-if="item.path === '/contacts' && totalUnread > 0"
            class="min-w-[18px] h-4.5 px-1 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center"
          >{{ totalUnread > 9 ? '9+' : totalUnread }}</span>
        </router-link>
      </nav>

      <!-- User / logout -->
      <div class="px-4 py-4 border-t border-white/[0.06]">
        <div class="text-xs text-zinc-600 mb-2 truncate">{{ auth.user?.username }}</div>
        <button
          @click="auth.logout()"
          class="flex items-center gap-2 text-xs text-zinc-600 hover:text-rose-400 transition-colors"
        >
          <Icon name="logout" :size="14" />
          Sign out
        </button>
      </div>
    </aside>
  `,
})
