import { defineComponent, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNodesStore } from '../stores/nodes.js'
import { useMessagesStore } from '../stores/messages.js'
import api from '../api.js'

export default defineComponent({
  name: 'Channels',
  setup() {
    const router = useRouter()
    const nodes = useNodesStore()
    const messages = useMessagesStore()

    const channels = ref([])
    const loading = ref(false)
    const error = ref(null)

    function displayName(ch) {
      const name = (ch.channel_name || '').trim()
      if (!name || name === '#Public') return 'Public'
      // Strip leading # for display
      return name.startsWith('#') ? name.slice(1) : name
    }

    function unread(ch) {
      return messages.unreadCounts[`channel-${nodes.activeNodeId}-${ch.channel_idx}`] || 0
    }

    function fmtTime(ts) {
      if (!ts) return null
      const d = new Date(ts)
      const diff = (Date.now() - d) / 1000
      if (diff < 60) return 'now'
      if (diff < 3600) return `${Math.floor(diff / 60)}m`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h`
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }

    function lastMessage(ch) {
      const key = `channel-${nodes.activeNodeId}-${ch.channel_idx}`
      const thread = messages.threads[key]
      return thread && thread.length ? thread[0] : null
    }

    async function load() {
      if (!nodes.activeNodeId) return
      loading.value = true
      error.value = null
      try {
        channels.value = await api.json(`/api/channels/?node_id=${nodes.activeNodeId}`)
        // Prefetch last message for each channel
        for (const ch of channels.value) {
          const key = `channel-${nodes.activeNodeId}-${ch.channel_idx}`
          if (!messages.threads[key]) {
            await messages.fetchThread(key, {
              node_id: nodes.activeNodeId,
              channel_idx: ch.channel_idx,
            })
          }
        }
      } catch (e) {
        error.value = e.message || 'Failed to load channels'
      } finally {
        loading.value = false
      }
    }

    function open(ch) {
      router.push(`/channels/${ch.channel_idx}`)
    }

    onMounted(load)

    return { channels, loading, error, displayName, unread, lastMessage, fmtTime, nodes, open }
  },
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="px-4 py-4 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
        <Icon name="hashtag" :size="18" class="text-zinc-500" />
        <h1 class="text-sm font-semibold text-zinc-100">Channels</h1>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">

        <!-- No node selected -->
        <div v-if="!nodes.activeNodeId" class="flex flex-col items-center justify-center h-full gap-3 text-zinc-600 px-8 text-center">
          <Icon name="wifi" :size="36" />
          <p class="text-sm">No node selected. Connect a node in Settings.</p>
        </div>

        <!-- Loading -->
        <div v-else-if="loading" class="flex items-center justify-center h-32">
          <Spinner />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="flex flex-col items-center justify-center h-32 gap-2 text-rose-400 px-8 text-center">
          <Icon name="warning" :size="24" />
          <p class="text-sm">{{ error }}</p>
        </div>

        <!-- Empty -->
        <div v-else-if="!channels.length" class="flex flex-col items-center justify-center h-32 gap-2 text-zinc-600 px-8 text-center">
          <Icon name="hashtag" :size="32" />
          <p class="text-sm">No channels found on this node.</p>
        </div>

        <!-- Channel list -->
        <ul v-else>
          <li
            v-for="ch in channels"
            :key="ch.channel_idx"
            @click="open(ch)"
            class="flex items-center gap-3 px-4 min-h-[56px] border-b border-white/[0.04] active:bg-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.03]"
          >
            <!-- Index badge -->
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
              :style="ch.channel_idx === 0
                ? 'background: linear-gradient(135deg, #7c3aed, #9333ea); color: white;'
                : 'background: rgba(255,255,255,0.06); color: rgb(161,161,170);'"
            >
              {{ ch.channel_idx === 0 ? '#' : ch.channel_idx }}
            </div>

            <!-- Name + last message -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-zinc-100 truncate">{{ displayName(ch) }}</span>
                <span
                  v-if="ch.channel_idx === 0"
                  class="text-[10px] px-1.5 py-0.5 rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-400 leading-none"
                >Public</span>
              </div>
              <div v-if="lastMessage(ch)" class="text-xs text-zinc-500 truncate mt-0.5">
                {{ lastMessage(ch).text }}
              </div>
              <div v-else class="text-xs text-zinc-600 mt-0.5">No messages yet</div>
            </div>

            <!-- Unread + time -->
            <div class="flex flex-col items-end gap-1 flex-shrink-0">
              <span
                v-if="lastMessage(ch)"
                class="text-[10px] text-zinc-600"
              >{{ fmtTime(lastMessage(ch).timestamp) }}</span>
              <span
                v-if="unread(ch) > 0"
                class="min-w-[18px] h-4.5 px-1 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center"
              >{{ unread(ch) > 9 ? '9+' : unread(ch) }}</span>
            </div>

            <Icon name="chevron-right" :size="14" class="text-zinc-700 flex-shrink-0" />
          </li>
        </ul>
      </div>
    </div>
  `,
})
