import { defineComponent, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNodesStore } from '../stores/nodes.js'
import { useMessagesStore } from '../stores/messages.js'
import { useToast } from '../components/shared/Toast.js'
import api from '../api.js'

export default defineComponent({
  name: 'Channels',
  setup() {
    const router = useRouter()
    const nodes = useNodesStore()
    const messages = useMessagesStore()
    const toast = useToast()

    const channels = ref([])
    const loading = ref(false)
    const error = ref(null)
    const search = ref('')

    // Add-channel modal state
    const showAdd = ref(false)
    const addType = ref('hashtag')
    const addName = ref('')
    const addSecret = ref('')
    const adding = ref(false)
    const createdChannel = ref(null)  // set after creating a private channel → share key view

    const filtered = computed(() => {
      if (!search.value.trim()) return channels.value
      const q = search.value.trim().toLowerCase()
      return channels.value.filter((ch) => displayName(ch).toLowerCase().includes(q))
    })

    const hasPublic = computed(() => channels.value.some((ch) => chanType(ch) === 'public'))

    function chanType(ch) {
      const name = (ch.channel_name || '').trim()
      if (name === 'Public' || name === '#Public') return 'public'
      if (name.startsWith('#')) return 'hashtag'
      return 'private'
    }

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

    function openAdd() {
      addType.value = 'hashtag'
      addName.value = ''
      addSecret.value = ''
      createdChannel.value = null
      showAdd.value = true
    }

    async function submitAdd() {
      if (adding.value) return
      adding.value = true
      try {
        const body = { node_id: nodes.activeNodeId, type: addType.value }
        if (addType.value !== 'public') body.name = addName.value.trim()
        if (addType.value === 'private' && addSecret.value.trim()) body.secret = addSecret.value.trim()

        const ch = await api.json('/api/channels/', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        await load()

        // Newly created private channel (no key supplied) → show key so it can be shared
        if (addType.value === 'private' && !addSecret.value.trim()) {
          createdChannel.value = ch
        } else {
          showAdd.value = false
          toast.success(`Joined ${displayName(ch)}`)
        }
      } catch (e) {
        toast.error(e.message || 'Failed to add channel')
      } finally {
        adding.value = false
      }
    }

    async function copyKey(secret) {
      try {
        await navigator.clipboard.writeText(secret)
        toast.success('Key copied to clipboard')
      } catch {
        toast.error('Could not copy key')
      }
    }

    onMounted(load)

    return {
      channels, filtered, loading, error, search, chanType, displayName, unread,
      lastMessage, fmtTime, nodes, router, hasPublic,
      showAdd, addType, addName, addSecret, adding, createdChannel,
      openAdd, submitAdd, copyKey,
    }
  },
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="px-4 py-4 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
        <Icon name="hashtag" :size="18" class="text-zinc-500 flex-shrink-0" />
        <h1 class="text-sm font-semibold text-zinc-100">Channels</h1>
        <div class="relative flex-1 max-w-xs ml-auto">
          <Icon name="magnifying-glass" :size="13" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          <input
            v-model="search"
            type="text"
            placeholder="Search…"
            class="w-full pl-7 pr-2.5 py-1.5 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-all"
            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
          />
        </div>
        <button
          v-if="nodes.activeNodeId"
          @click="openAdd"
          class="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 transition-transform active:scale-95"
          style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
          title="Add channel"
        >
          <Icon name="plus" :size="16" />
        </button>
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

        <!-- No search results -->
        <div v-else-if="filtered.length === 0 && search" class="flex flex-col items-center justify-center h-32 text-zinc-500 text-sm">
          No channels match "{{ search }}"
        </div>

        <!-- Channel list -->
        <ul v-else>
          <li
            v-for="ch in filtered"
            :key="ch.channel_idx"
            @click="router.push('/channels/' + ch.channel_idx)"
            class="flex items-center gap-3 px-4 min-h-[56px] border-b border-white/[0.04] cursor-pointer active:bg-white/[0.04] transition-colors hover:bg-white/[0.03]"
          >
            <!-- Type badge -->
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
              :style="chanType(ch) === 'public'
                ? 'background: linear-gradient(135deg, #7c3aed, #9333ea); color: white;'
                : 'background: rgba(255,255,255,0.06); color: rgb(161,161,170);'"
            >
              <template v-if="chanType(ch) === 'private'"><Icon name="key" :size="15" /></template>
              <template v-else>#</template>
            </div>

            <!-- Name + last message -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-zinc-100 truncate">{{ displayName(ch) }}</span>
                <span
                  v-if="chanType(ch) === 'public'"
                  class="text-[10px] px-1.5 py-0.5 rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-400 leading-none"
                >Public</span>
                <span
                  v-else-if="chanType(ch) === 'private'"
                  class="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 leading-none"
                >Private</span>
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

      <!-- Add channel modal -->
      <Modal :show="showAdd" :title="createdChannel ? 'Channel created' : 'Add channel'" @close="showAdd = false">
        <!-- Share key view (after creating a private channel) -->
        <div v-if="createdChannel" class="space-y-4">
          <p class="text-sm text-zinc-400">
            <span class="text-zinc-100 font-medium">{{ displayName(createdChannel) }}</span>
            was created. Share this secret key with others so they can join:
          </p>
          <div class="flex items-center gap-2">
            <code
              class="flex-1 px-3.5 py-2.5 rounded-xl text-sm text-violet-300 break-all"
              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
            >{{ createdChannel.channel_secret }}</code>
            <button
              @click="copyKey(createdChannel.channel_secret)"
              class="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors flex-shrink-0"
              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
              title="Copy key"
            >
              <Icon name="clipboard" :size="17" />
            </button>
          </div>
          <div class="flex justify-end">
            <button
              @click="showAdd = false"
              class="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
            >Done</button>
          </div>
        </div>

        <!-- Add form -->
        <div v-else class="space-y-4">
          <!-- Type selector -->
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="t in ['hashtag', 'private', 'public']"
              :key="t"
              :disabled="t === 'public' && hasPublic"
              @click="addType = t"
              class="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              :class="addType === t
                ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                : 'text-zinc-500 border border-white/[0.08] hover:bg-white/[0.04]'"
            >
              <Icon :name="t === 'hashtag' ? 'hashtag' : t === 'private' ? 'key' : 'globe'" :size="18" />
              {{ t === 'hashtag' ? 'Hashtag' : t === 'private' ? 'Private' : 'Public' }}
            </button>
          </div>

          <p class="text-xs text-zinc-500 leading-relaxed">
            <template v-if="addType === 'hashtag'">
              Anyone who joins a hashtag channel with the same name can read and send messages. The key is derived from the name.
            </template>
            <template v-else-if="addType === 'private'">
              Private channels are encrypted with a 16-byte secret key. Leave the key empty to create a new channel, or paste a key to join an existing one.
            </template>
            <template v-else>
              Rejoin the well-known MeshCore Public channel.
            </template>
          </p>

          <!-- Name -->
          <div v-if="addType !== 'public'">
            <label class="block text-xs text-zinc-500 mb-1.5">Channel name</label>
            <div class="relative">
              <span
                v-if="addType === 'hashtag'"
                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none"
              >#</span>
              <input
                v-model="addName"
                type="text"
                maxlength="31"
                :placeholder="addType === 'hashtag' ? 'general' : 'My channel'"
                :class="addType === 'hashtag' ? 'pl-7 pr-3.5' : 'px-3.5'"
                class="w-full py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
                @keyup.enter="submitAdd"
              />
            </div>
          </div>

          <!-- Secret key (private only) -->
          <div v-if="addType === 'private'">
            <label class="block text-xs text-zinc-500 mb-1.5">Secret key <span class="text-zinc-600">(base64, empty = generate new)</span></label>
            <input
              v-model="addSecret"
              type="text"
              placeholder="izOH6cXN6mrJ5e26oRXNcg=="
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none font-mono"
              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
              @keyup.enter="submitAdd"
            />
          </div>

          <div class="flex justify-end gap-3 pt-1">
            <button
              @click="showAdd = false"
              class="px-4 py-2 rounded-xl text-sm text-zinc-400 transition-all hover:bg-white/[0.05]"
              style="border: 1px solid rgba(255,255,255,0.08);"
            >Cancel</button>
            <button
              @click="submitAdd"
              :disabled="adding || (addType !== 'public' && !addName.trim())"
              class="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center gap-2"
              style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
            >
              <Spinner v-if="adding" class="h-3.5 w-3.5" />
              {{ addType === 'private' && !addSecret.trim() ? 'Create' : 'Join' }}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  `,
})
