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
        if (c.contact_type === 2) continue // skip repeaters (REP)
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
      sendMessage, selectConv, relativeTime, contactForMsg, router,
    }
  },
  template: `
    <div class="h-full flex overflow-hidden">

      <!-- ── Conversation list ──────────────────────────────────────────── -->
      <!-- Mobile: full-screen when no active conv. Desktop: fixed sidebar. -->
      <div :class="[
        'flex flex-col bg-gray-950 border-r border-gray-800',
        activeKey
          ? 'hidden md:flex md:w-64 md:flex-shrink-0'
          : 'flex-1 md:w-64 md:flex-shrink-0'
      ]">
        <div class="px-4 pt-6 pb-3 flex-shrink-0">
          <h1 class="text-2xl font-bold text-white">Messages</h1>
        </div>

        <div class="flex-1 overflow-y-auto">
          <div v-if="!conversations.length" class="px-4 py-12 text-center text-gray-600 text-sm">
            No conversations yet
          </div>
          <button
            v-for="conv in conversations"
            :key="conv.key"
            @click="selectConv(conv)"
            :class="[
              'w-full text-left px-4 py-4 flex items-center gap-3 border-b border-gray-800/60 transition-colors active:bg-gray-800',
              activeKey === conv.key ? 'bg-gray-900' : 'hover:bg-gray-900/50'
            ]"
          >
            <div class="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-base font-bold"
                 :class="conv.type === 'channel' ? 'bg-purple-900 text-purple-300' : 'bg-gray-800 text-gray-300'">
              {{ conv.type === 'channel' ? '#' : conv.label[0].toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-medium text-white truncate">{{ conv.label }}</div>
              <div class="text-xs text-gray-500 mt-0.5">{{ conv.type === 'channel' ? 'Channel' : 'Direct' }}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span v-if="conv.unread" class="min-w-[20px] h-5 px-1 rounded-full bg-mesh-600 text-white text-xs font-bold flex items-center justify-center">
                {{ conv.unread > 9 ? '9+' : conv.unread }}
              </span>
              <Icon name="arrow-right" :size="14" class="text-gray-700" />
            </div>
          </button>
        </div>
      </div>

      <!-- ── Message thread ─────────────────────────────────────────────── -->
      <!-- Mobile: full-screen when active. Desktop: flex-1 remainder.      -->
      <div :class="[
        'flex flex-col min-w-0',
        activeKey ? 'flex-1' : 'hidden md:flex md:flex-1'
      ]">
        <!-- No conversation selected (desktop only) -->
        <div v-if="!activeConv" class="flex-1 flex items-center justify-center text-gray-700">
          Select a conversation
        </div>

        <template v-else>
          <!-- Header -->
          <div class="px-4 py-3.5 border-b border-gray-800 bg-gray-950 flex items-center gap-3 flex-shrink-0">
            <!-- Back button — mobile only -->
            <button
              class="md:hidden -ml-1 p-1.5 rounded-lg text-gray-400 hover:text-white transition-colors"
              @click="router.push('/chat')"
              aria-label="Back"
            >
              <Icon name="arrow-left" :size="22" />
            </button>
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                 :class="activeConv.type === 'channel' ? 'bg-purple-900 text-purple-300' : 'bg-gray-800 text-gray-300'">
              {{ activeConv.type === 'channel' ? '#' : activeConv.label[0].toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-white truncate">{{ activeConv.label }}</div>
              <div class="text-xs text-gray-500">{{ activeConv.type === 'channel' ? 'Channel' : 'Direct message' }}</div>
            </div>
          </div>

          <!-- Messages -->
          <div ref="threadRef" class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <div
              v-for="msg in thread"
              :key="msg.id"
              :class="['flex', msg.direction === 'out' ? 'justify-end' : 'justify-start']"
            >
              <div :class="['max-w-[80%] sm:max-w-sm lg:max-w-md flex flex-col gap-1', msg.direction === 'out' ? 'items-end' : 'items-start']">
                <div :class="[
                  'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                  msg.direction === 'out'
                    ? 'bg-mesh-700 text-white rounded-br-sm'
                    : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                ]">{{ msg.text }}</div>
                <div class="flex items-center gap-2 px-1">
                  <span class="text-xs text-gray-600">{{ relativeTime(msg.timestamp) }}</span>
                  <SignalBadge v-if="msg.snr != null" :snr="msg.snr" :rssi="msg.rssi" />
                  <span
                    v-if="msg.direction === 'out'"
                    :title="msg.status === 'acked' ? 'Received by destination' : msg.status === 'sent' ? 'Seen by mesh' : msg.status === 'failed' ? 'Failed to send' : 'Sending…'"
                    class="flex items-center text-gray-600"
                  >
                    <Icon v-if="msg.status === 'failed'" name="x-circle" :size="12" class="text-red-500" />
                    <Icon v-else-if="msg.status === 'acked'" name="check-circle" :size="12" />
                    <Icon v-else-if="msg.status === 'sent'" name="check" :size="12" />
                    <Icon v-else name="clock" :size="12" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Input -->
          <div class="px-4 py-3 border-t border-gray-800 bg-gray-950 flex-shrink-0">
            <form @submit.prevent="sendMessage" class="flex gap-2">
              <input
                v-model="text"
                type="text"
                placeholder="Message…"
                autocomplete="off"
                :disabled="sending"
                class="flex-1 px-4 py-3 rounded-2xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-mesh-500 text-sm transition-colors"
              />
              <button
                type="submit"
                :disabled="sending || !text.trim()"
                class="w-12 h-12 rounded-2xl bg-mesh-600 hover:bg-mesh-500 disabled:opacity-40 text-white flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Send"
              >
                <Icon name="arrow-right" :size="18" />
              </button>
            </form>
          </div>
        </template>
      </div>
    </div>
  `,
})
