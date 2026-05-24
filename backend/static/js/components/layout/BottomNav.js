import { defineComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const NAV = [
  { path: '/',         label: 'Home',     icon: 'grid' },
  { path: '/chat',     label: 'Chat',     icon: 'chat' },
  { path: '/nodes',    label: 'Nodes',    icon: 'cpu-chip' },
  { path: '/contacts', label: 'Contacts', icon: 'users' },
  { path: '/groups',   label: 'Groups',   icon: 'user-group' },
  { path: '/settings', label: 'Settings', icon: 'cog' },
]

export default defineComponent({
  name: 'BottomNav',
  setup() {
    const route = useRoute()
    const router = useRouter()

    function isActive(path) {
      if (path === '/') return route.path === '/'
      return route.path.startsWith(path)
    }

    return { NAV, isActive, router }
  },
  template: `
    <nav
      class="fixed bottom-0 left-0 right-0 z-50 flex bg-gray-900 border-t border-gray-800"
      style="padding-bottom: env(safe-area-inset-bottom, 0)"
    >
      <button
        v-for="item in NAV"
        :key="item.path"
        @click="router.push(item.path)"
        :class="[
          'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-w-0',
          isActive(item.path) ? 'text-mesh-400' : 'text-gray-500 active:text-gray-300'
        ]"
        :aria-label="item.label"
      >
        <Icon :name="item.icon" :size="22" />
        <span class="text-[10px] leading-none tracking-tight">{{ item.label }}</span>
      </button>
    </nav>
  `,
})
