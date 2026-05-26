import { defineComponent, ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNodesStore } from '../stores/nodes.js'
import { useMessagesStore } from '../stores/messages.js'
import { useToast } from '../components/shared/Toast.js'
import api from '../api.js'

export default defineComponent({
  name: 'ChannelDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const nodes = useNodesStore()
    const messages = useMessagesStore()
    const toast = useToast()

    const channelIdx = Number(route.params.idx)
    const threadKey = computed(() => `channel-${nodes.activeNodeId}-${channelIdx}`)

    const channelName = ref(null)  // null until loaded
    const sending = ref(false)

    const thread = computed(() => messages.threads[threadKey.value] || [])

    async function load() {
      try {
        // Fetch channel info to get the display name
        const channels = await api.json(`/api/channels/?node_id=${nodes.activeNodeId}`)
        const ch = channels.find((c) => c.channel_idx === channelIdx)
        const raw = (ch?.channel_name || '').trim()
        channelName.value = (!raw || raw === '#Public')
          ? 'Public'
          : (raw.startsWith('#') ? raw.slice(1) : raw)

        messages.clearUnread(threadKey.value)
        await messages.fetchThread(threadKey.value, {
          node_id: nodes.activeNodeId,
          channel_idx: channelIdx,
        })
      } catch {
        toast.error('Failed to load channel')
      }
    }

    async function sendMsg(text) {
      if (sending.value) return
      sending.value = true
      try {
        await messages.send({
          node_id: nodes.activeNodeId,
          msg_type: 'channel',
          channel_idx: channelIdx,
          text,
        })
      } catch (e) {
        toast.error(e.message || 'Failed to send')
      } finally {
        sending.value = false
      }
    }

    onMounted(load)

    return { channelIdx, channelName, thread, sending, sendMsg, router }
  },
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div
        class="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]"
        style="background: rgba(9,9,15,0.7); backdrop-filter: blur(16px);"
      >
        <button @click="router.push('/channels')" class="text-zinc-500 hover:text-zinc-200 transition-colors">
          <Icon name="chevron-left" :size="22" />
        </button>

        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
          :style="channelIdx === 0 ? 'background: linear-gradient(135deg, #7c3aed, #9333ea); color: white;' : 'background: rgba(255,255,255,0.06); color: rgb(161,161,170);'"
        >
          {{ channelIdx === 0 ? '#' : channelIdx }}
        </div>

        <div class="flex-1 min-w-0">
          <div v-if="channelName !== null" class="text-sm font-semibold text-white truncate">{{ channelName }}</div>
          <Spinner v-else class="h-4 w-4" />
          <div class="text-[10px] text-zinc-600">Channel {{ channelIdx }}</div>
        </div>
      </div>

      <!-- Chat -->
      <ChatPanel :thread="thread" :sending="sending" :focused="true" @send="sendMsg" />
    </div>
  `,
})
