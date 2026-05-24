import { defineComponent, ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNodesStore } from '../stores/nodes.js'
import { useContactsStore } from '../stores/contacts.js'
import { useMessagesStore } from '../stores/messages.js'
import { useToast } from '../components/shared/Toast.js'

export default defineComponent({
  name: 'Chat',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const nodes = useNodesStore()
    const contacts = useContactsStore()
    const messages = useMessagesStore()
    const toast = useToast()

    const text = ref('')
    const sending = ref(false)
    const threadRef = ref(null)

    // Build conversation list from contacts + channels
    const conversations = computed(() => {
      const convs = []
      for (const c of contacts.contacts) {
        const key = `direct-${c.id}`
        const unread = messages.unreadCounts[key] || 0
        convs.push({ key, type: 'direct', label: c.adv_name || c.public_key.slice(0, 12), contact: c, unread })
      }
      // Add channel conversations discovered from messages
      const channelsSeen = new Set()
      for (const [key] of Object.entries(messages.threads)) {
        if (key.startsWith('channel-') && !channelsSeen.has(key)) {
          channelsSeen.add(key)
          const [, nodeId, chIdx] = key.split('-')
          const node = nodes.nodes.find((n) => n.id === Number(nodeId))
          convs.push({
            key,
            type: 'channel',
            label: `Ch ${chIdx} — ${node?.name || 'Unknown'}`,
            node_id: Number(nodeId),
            channel_idx: Number(chIdx),
            unread: messages.unreadCounts[key] || 0,
          })
        }
      }
      return convs
    })

    const activeKey = computed(() => {
      const { type, id } = route.params
      if (!type || !id) return null
      if (type === 'direct') return `direct-${id}`
      return `channel-${id.replace('_', '-')}`
    })

    const activeConv = computed(() =>
      conversations.value.find((c) => c.key === activeKey.value) || null
    )

    const thread = computed(() => {
      if (!activeKey.value) return []
      return (messages.threads[activeKey.value] || []).slice().reverse()
    })

    function contactForMsg(msg) {
      return contacts.contacts.find((c) => c.id === msg.contact_id)
    }

    async function loadThread() {
      if (!activeKey.value) return
      messages.clearUnread(activeKey.value)

      const conv = activeConv.value
      if (!conv) return

      const params = conv.type === 'direct'
        ? { contact_id: conv.contact.id }
        : { node_id: conv.node_id, channel_idx: conv.channel_idx }

      await messages.fetchThread(activeKey.value, params)
      await nextTick()
      scrollToBottom()
    }

    function scrollToBottom() {
      if (threadRef.value) threadRef.value.scrollTop = threadRef.value.scrollHeight
    }

    watch(activeKey, loadThread, { immediate: true })
    watch(() => thread.value.length, () => nextTick(scrollToBottom))

    async function sendMessage() {
      if (!text.value.trim() || !activeConv.value) return
      sending.value = true
      try {
        const conv = activeConv.value
        const payload = conv.type === 'direct'
          ? { node_id: conv.contact.node_id, msg_type: 'direct', contact_id: conv.contact.id, text: text.value }
          : { node_id: conv.node_id, msg_type: 'channel', channel_idx: conv.channel_idx, text: text.value }
        await messages.send(payload)
        text.value = ''
      } catch (e) {
        toast.error(e.message)
      } finally {
        sending.value = false
      }
    }

    function relativeTime(iso) {
      if (!iso) return ''
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    function selectConv(conv) {
      if (conv.type === 'direct') {
        router.push(`/chat/direct/${conv.contact.id}`)
      } else {
        router.push(`/chat/channel/${conv.node_id}_${conv.channel_idx}`)
      }
    }

    onMounted(() => {
      if (!contacts.contacts.length) contacts.fetchAll()
    })

    return {
      conversations, activeKey, activeConv, thread, text, sending, threadRef,
      sendMessage, selectConv, relativeTime, contactForMsg,
    }
  },
  template: `
    <div class="h-full flex overflow-hidden">
      <!-- Sidebar: conversation list -->
      <div class="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div class="px-4 py-4 border-b border-gray-800">
          <h2 class="font-semibold text-white">Messages</h2>
        </div>
        <div class="flex-1 overflow-y-auto scrollbar-thin">
          <div v-if="!conversations.length" class="p-4 text-sm text-gray-600">No conversations yet</div>
          <button
            v-for="conv in conversations"
            :key="conv.key"
            @click="selectConv(conv)"
            :class="[
              'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition-colors',
              activeKey === conv.key ? 'bg-gray-800' : ''
            ]"
          >
            <div class="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
                 :class="conv.type === 'channel' ? 'bg-purple-900 text-purple-300' : 'bg-gray-700 text-gray-300'">
              {{ conv.type === 'channel' ? '#' : conv.label[0].toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-white truncate">{{ conv.label }}</div>
              <div class="text-xs text-gray-500">{{ conv.type }}</div>
            </div>
            <span v-if="conv.unread" class="w-5 h-5 rounded-full bg-mesh-600 text-white text-xs flex items-center justify-center flex-shrink-0">
              {{ conv.unread > 9 ? '9+' : conv.unread }}
            </span>
          </button>
        </div>
      </div>

      <!-- Message thread -->
      <div class="flex-1 flex flex-col min-w-0">
        <div v-if="!activeConv" class="flex-1 flex items-center justify-center text-gray-600">
          Select a conversation
        </div>
        <template v-else>
          <!-- Header -->
          <div class="px-5 py-4 border-b border-gray-800 bg-gray-900 flex items-center gap-3">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                 :class="activeConv.type === 'channel' ? 'bg-purple-900 text-purple-300' : 'bg-gray-700 text-gray-300'">
              {{ activeConv.type === 'channel' ? '#' : activeConv.label[0].toUpperCase() }}
            </div>
            <div>
              <div class="font-semibold text-white">{{ activeConv.label }}</div>
              <div class="text-xs text-gray-500">{{ activeConv.type === 'channel' ? 'Channel' : 'Direct message' }}</div>
            </div>
          </div>

          <!-- Messages -->
          <div ref="threadRef" class="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-3">
            <div
              v-for="msg in thread"
              :key="msg.id"
              :class="['flex', msg.direction === 'out' ? 'justify-end' : 'justify-start']"
            >
              <div :class="['max-w-xs lg:max-w-md', msg.direction === 'out' ? 'items-end' : 'items-start', 'flex flex-col gap-1']">
                <div
                  :class="[
                    'px-4 py-2.5 rounded-2xl text-sm',
                    msg.direction === 'out'
                      ? 'bg-mesh-700 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                  ]"
                >{{ msg.text }}</div>
                <div class="flex items-center gap-2 px-1">
                  <span class="text-xs text-gray-600">{{ relativeTime(msg.timestamp) }}</span>
                  <SignalBadge v-if="msg.snr != null" :snr="msg.snr" :rssi="msg.rssi" />
                  <span v-if="msg.direction === 'out'" class="text-xs text-gray-600">
                    {{ msg.status === 'acked' ? '✓✓' : msg.status === 'sent' ? '✓' : msg.status === 'failed' ? '✕' : '…' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Input -->
          <div class="px-5 py-4 border-t border-gray-800 bg-gray-900">
            <form @submit.prevent="sendMessage" class="flex gap-3">
              <input
                v-model="text"
                type="text"
                placeholder="Type a message…"
                :disabled="sending"
                class="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-mesh-500 text-sm transition-colors"
              />
              <button
                type="submit"
                :disabled="sending || !text.trim()"
                class="px-5 py-2.5 rounded-xl bg-mesh-600 hover:bg-mesh-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {{ sending ? '…' : 'Send' }}
              </button>
            </form>
          </div>
        </template>
      </div>
    </div>
  `,
})
