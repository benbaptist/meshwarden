import { defineComponent, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessagesStore } from '../../stores/messages.js'

const NAV = [
  { path: '/',         label: 'Map',      icon: 'map' },
  { path: '/contacts', label: 'Contacts', icon: 'users' },
  { path: '/settings', label: 'Settings', icon: 'cog' },
]

export default defineComponent({
  name: 'BottomNav',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const messages = useMessagesStore()

    const totalUnread = computed(() =>
      Object.values(messages.unreadCounts).reduce((s, n) => s + n, 0)
    )

    function isActive(path) {
      if (path === '/') return route.path === '/'
      return route.path.startsWith(path)
    }

    return { NAV, isActive, router, totalUnread }
  },
  template: `
    <nav
      class="flex border-t border-white/[0.06]"
      style="background: rgba(9,9,15,0.9); backdrop-filter: blur(20px); padding-bottom: env(safe-area-inset-bottom, 0);"
    >
      <button
        v-for="item in NAV"
        :key="item.path"
        @click="router.push(item.path)"
        :class="[
          'flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors min-w-0 relative',
          isActive(item.path) ? 'text-violet-400' : 'text-zinc-600 active:text-zinc-300'
        ]"
        :aria-label="item.label"
      >
        <div class="relative">
          <Icon :name="item.icon" :size="22" />
          <span
            v-if="item.path === '/contacts' && totalUnread > 0"
            class="absolute -top-1 -right-2 min-w-[16px] h-4 px-0.5 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center"
          >{{ totalUnread > 9 ? '9+' : totalUnread }}</span>
        </div>
        <span class="text-[10px] leading-none tracking-tight">{{ item.label }}</span>
      </button>
    </nav>
  `,
})
