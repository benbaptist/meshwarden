import { defineComponent, ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNodesStore } from '../stores/nodes.js'
import { useMessagesStore } from '../stores/messages.js'
import { useContactsStore } from '../stores/contacts.js'
import { useToast } from '../components/shared/Toast.js'
import api from '../api.js'

export default defineComponent({
  name: 'ChannelDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const nodes = useNodesStore()
    const messages = useMessagesStore()
    const contacts = useContactsStore()
    const toast = useToast()

    const channelIdx = Number(route.params.idx)
    const threadKey = computed(() => `channel-${nodes.activeNodeId}-${channelIdx}`)

    const channel = ref(null)  // null until loaded
    const sending = ref(false)
    const showDelete = ref(false)
    const deleting = ref(false)

    const thread = computed(() => messages.threads[threadKey.value] || [])

    const channelName = computed(() => {
      if (!channel.value) return null
      const raw = (channel.value.channel_name || '').trim()
      if (!raw || raw === '#Public') return 'Public'
      return raw.startsWith('#') ? raw.slice(1) : raw
    })

    const chanType = computed(() => {
      if (!channel.value) return null
      const name = (channel.value.channel_name || '').trim()
      if (name === 'Public' || name === '#Public') return 'public'
      if (name.startsWith('#')) return 'hashtag'
      return 'private'
    })

    async function load() {
      try {
        const channels = await api.json(`/api/channels/?node_id=${nodes.activeNodeId}`)
        channel.value = channels.find((c) => c.channel_idx === channelIdx) || null

        messages.clearUnread(threadKey.value)
        await messages.fetchThread(threadKey.value, {
          node_id: nodes.activeNodeId,
          channel_idx: channelIdx,
        })
      } catch {
        toast.error('Failed to load channel')
      }
    }

    async function copyKey() {
      try {
        await navigator.clipboard.writeText(channel.value.channel_secret)
        toast.success('Key copied to clipboard')
      } catch {
        toast.error('Could not copy key')
      }
    }

    async function deleteChannel() {
      if (deleting.value) return
      deleting.value = true
      try {
        await api.json(`/api/channels/${channelIdx}?node_id=${nodes.activeNodeId}`, { method: 'DELETE' })
        toast.success(`Left ${channelName.value}`)
        router.push('/channels')
      } catch (e) {
        toast.error(e.message || 'Failed to remove channel')
      } finally {
        deleting.value = false
        showDelete.value = false
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

    function onSenderClick(advName) {
      const contact = Object.values(contacts.contacts).find(
        (c) => c.adv_name === advName || c.custom_name === advName
      )
      if (contact) router.push(`/contacts/${contact.id}`)
    }

    return {
      channelIdx, channel, channelName, chanType, thread, sending, sendMsg, onSenderClick, router,
      showDelete, deleting, copyKey, deleteChannel,
    }
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
          :style="chanType === 'public' ? 'background: linear-gradient(135deg, #7c3aed, #9333ea); color: white;' : 'background: rgba(255,255,255,0.06); color: rgb(161,161,170);'"
        >
          <template v-if="chanType === 'private'"><Icon name="key" :size="15" /></template>
          <template v-else>#</template>
        </div>

        <div class="flex-1 min-w-0">
          <div v-if="channelName !== null" class="text-sm font-semibold text-white truncate">{{ channelName }}</div>
          <Spinner v-else class="h-4 w-4" />
          <div class="text-[10px] text-zinc-600">Channel {{ channelIdx }}</div>
        </div>

        <button
          v-if="chanType === 'private'"
          @click="copyKey"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0"
          title="Copy secret key"
        >
          <Icon name="key" :size="17" />
        </button>
        <button
          v-if="channel"
          @click="showDelete = true"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-rose-400 transition-colors flex-shrink-0"
          title="Remove channel"
        >
          <Icon name="trash" :size="17" />
        </button>
      </div>

      <!-- Chat -->
      <ChatPanel :thread="thread" :sending="sending" :focused="true" @send="sendMsg" @sender-click="onSenderClick" />

      <ConfirmDialog
        :show="showDelete"
        title="Remove channel"
        :message="'Remove ' + channelName + ' from this node? ' + (chanType === 'private' ? 'You will need the secret key to rejoin.' : 'You can rejoin it at any time.')"
        confirm-label="Remove"
        danger
        @confirm="deleteChannel"
        @cancel="showDelete = false"
      />
    </div>
  `,
})
