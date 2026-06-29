import { defineComponent, ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useContactsStore } from '../stores/contacts.js'
import { useNodesStore } from '../stores/nodes.js'
import { useMessagesStore } from '../stores/messages.js'
import { useGroupsStore } from '../stores/groups.js'
import { useToast } from '../components/shared/Toast.js'

const TYPE_META = {
  CLI:  { label: 'Client',   bg: 'bg-violet-500/15 border-violet-500/20 text-violet-300' },
  REP:  { label: 'Repeater', bg: 'bg-cyan-500/15 border-cyan-500/20 text-cyan-300' },
  ROOM: { label: 'Room',     bg: 'bg-amber-500/15 border-amber-500/20 text-amber-300' },
  SENS: { label: 'Sensor',   bg: 'bg-emerald-500/15 border-emerald-500/20 text-emerald-300' },
  NONE: { label: 'Unknown',  bg: 'bg-zinc-500/15 border-zinc-500/20 text-zinc-400' },
}

const GRADIENTS = [
  ['#7c3aed', '#4f46e5'],
  ['#0e7490', '#0891b2'],
  ['#d97706', '#b45309'],
  ['#059669', '#047857'],
  ['#be185d', '#9d174d'],
  ['#6d28d9', '#7c3aed'],
]

function nameHash(name) {
  let h = 0
  for (const c of (name || '?')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

export default defineComponent({
  name: 'Contacts',
  setup() {
    const router = useRouter()
    const contacts = useContactsStore()
    const nodes = useNodesStore()
    const messages = useMessagesStore()
    const groups = useGroupsStore()
    const toast = useToast()

    const search = ref('')
    const pingingId = ref(null)
    const pingResults = ref({})

    // Advert state
    const adverting = ref(false)

    // My Info modal
    const showMyInfo = ref(false)
    const myInfoUri = ref(null)
    const myInfoLoading = ref(false)

    async function sendAdvert(flood = false) {
      if (adverting.value || !nodes.activeNodeId) return
      adverting.value = true
      try {
        await nodes.advertise(nodes.activeNodeId, flood)
        toast.success(flood ? 'Flood advert sent' : 'Zero-hop advert sent')
      } catch (e) {
        toast.error(e.message || 'Advert failed')
      } finally {
        adverting.value = false
      }
    }

    async function openMyInfo() {
      showMyInfo.value = true
      myInfoUri.value = null
      myInfoLoading.value = true
      try {
        const data = await nodes.getContactUri(nodes.activeNodeId)
        myInfoUri.value = typeof data === 'string' ? data : data.uri
      } catch (e) {
        toast.error(e.message || 'Failed to get contact URI')
      } finally {
        myInfoLoading.value = false
      }
    }

    function renderQr(uri) {
      const canvas = document.getElementById('my-info-qr')
      if (!canvas || !uri || typeof QRCode === 'undefined') return
      QRCode.toCanvas(canvas, uri, {
        width: 220,
        margin: 2,
        color: { dark: '#e4e4e7', light: '#09090f' },
      })
    }

    // Render QR after DOM updates (flush:post ensures canvas is mounted)
    watch(myInfoUri, (uri) => { if (uri) renderQr(uri) }, { flush: 'post' })

    onMounted(async () => {
      if (!contacts.contacts.length) {
        await contacts.fetchAll(contacts.activeGroupId ? { group_id: contacts.activeGroupId } : {})
      }
      if (!groups.groups.length) await groups.fetchAll()
    })

    async function selectGroup(id) {
      contacts.activeGroupId = id
      await contacts.fetchAll(id !== null ? { group_id: id } : {})
    }

    async function toggleFavorite(e, c) {
      e.stopPropagation()
      await contacts.toggleFavorite(c.id)
    }

    async function doPing(e, c) {
      e.stopPropagation()
      if (pingingId.value) return
      pingingId.value = c.id
      pingResults.value = { ...pingResults.value, [c.id]: null }
      try {
        const res = await contacts.ping(c.id)
        pingResults.value = { ...pingResults.value, [c.id]: { success: res.success, latency_ms: res.latency_ms } }
      } catch {
        pingResults.value = { ...pingResults.value, [c.id]: { success: false, latency_ms: null } }
      } finally {
        pingingId.value = null
      }
    }

    function openAdmin(e, c) {
      e.stopPropagation()
      router.push(`/contacts/${c.id}?tab=info`)
    }

    const nodeFiltered = computed(() =>
      nodes.activeNodeId
        ? contacts.contacts.filter((c) => c.node_id === nodes.activeNodeId)
        : contacts.contacts
    )

    const filtered = computed(() => {
      let list = nodeFiltered.value
      if (search.value.trim()) {
        const q = search.value.trim().toLowerCase()
        list = list.filter(
          (c) => (c.adv_name || '').toLowerCase().includes(q) || (c.short_name || '').toLowerCase().includes(q)
        )
      }
      return [...list].sort((a, b) => {
        if (a.favorite && !b.favorite) return -1
        if (!a.favorite && b.favorite) return 1
        const ta = a.last_heard ? new Date(a.last_heard).getTime() : 0
        const tb = b.last_heard ? new Date(b.last_heard).getTime() : 0
        return tb - ta
      })
    })

    function unread(c) {
      return messages.unreadCounts[`direct-${c.id}`] || 0
    }

    function avatarStyle(c) {
      const name = c.adv_name || c.short_name || '?'
      const [from, to] = GRADIENTS[nameHash(name) % GRADIENTS.length]
      return `linear-gradient(135deg, ${from}, ${to})`
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

    function open(c) { router.push(`/contacts/${c.id}`) }

    return {
      contacts, nodes, groups, search, pingingId, pingResults,
      filtered, nodeFiltered, selectGroup, toggleFavorite, doPing, openAdmin,
      unread, avatarStyle, fmtTime, open,
      adverting, sendAdvert, showMyInfo, myInfoUri, myInfoLoading, openMyInfo,
      TYPE_META,
    }
  },
  template: `
    <div class="h-full flex flex-col">
      <!-- Header (matches Channels style) -->
      <div class="px-4 py-4 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
        <Icon name="users" :size="18" class="text-zinc-500 flex-shrink-0" />
        <h1 class="text-sm font-semibold text-zinc-100">Contacts</h1>
        <div class="relative flex-1 max-w-xs ml-auto">
          <Icon name="magnifying-glass" :size="13" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          <input
            v-model="search"
            type="text"
            autocomplete="new-password"
            placeholder="Search…"
            class="w-full pl-7 pr-2.5 py-1.5 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-all"
            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
          />
        </div>
        <!-- Advert + My Info buttons -->
        <div v-if="nodes.activeNodeId" class="flex items-center gap-1 flex-shrink-0">
          <button
            @click="sendAdvert(false)"
            :disabled="adverting"
            title="Send zero-hop advertisement (direct neighbors only)"
            class="h-8 w-8 flex items-center justify-center rounded-lg transition-colors text-zinc-500 hover:text-violet-300 hover:bg-violet-500/10 disabled:opacity-40"
          ><Icon name="megaphone" :size="15" /></button>
          <button
            @click="sendAdvert(true)"
            :disabled="adverting"
            title="Send flood advertisement (entire network)"
            class="h-8 w-8 flex items-center justify-center rounded-lg transition-colors text-zinc-500 hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
          ><Icon name="signal" :size="15" /></button>
          <button
            @click="openMyInfo"
            title="My contact info + QR code"
            class="h-8 w-8 flex items-center justify-center rounded-lg transition-colors text-zinc-500 hover:text-cyan-300 hover:bg-cyan-500/10"
          ><Icon name="qr-code" :size="15" /></button>
        </div>
      </div>

      <!-- My Info Modal -->
      <Modal :show="showMyInfo" @close="showMyInfo = false">
        <div class="p-6 w-full max-w-xs text-center">
          <div class="text-sm font-bold text-white mb-1">My Contact Info</div>
          <div class="text-xs text-zinc-500 mb-4">Others can scan this QR code to add you as a contact</div>
          <div class="flex items-center justify-center mb-4">
            <Spinner v-if="myInfoLoading" />
            <canvas v-else id="my-info-qr" class="rounded-xl" style="image-rendering: pixelated;" />
          </div>
          <div v-if="myInfoUri" class="text-[10px] text-zinc-600 font-mono break-all px-2">{{ myInfoUri }}</div>
        </div>
      </Modal>

      <!-- Group filter chips -->
      <div v-if="groups.groups.length" class="flex-shrink-0 flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none border-b border-white/[0.04]">
        <button
          @click="selectGroup(null)"
          :class="[
            'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all border',
            contacts.activeGroupId === null
              ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
              : 'text-zinc-500 border-white/[0.08] hover:text-zinc-300 hover:border-white/[0.15]'
          ]"
        >All</button>
        <button
          v-for="g in groups.groups"
          :key="g.id"
          @click="selectGroup(g.id)"
          :class="[
            'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all border',
            contacts.activeGroupId === g.id
              ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
              : 'text-zinc-500 border-white/[0.08] hover:text-zinc-300 hover:border-white/[0.15]'
          ]"
        >{{ g.name }}</button>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto scrollbar-none">
        <div v-if="!nodes.nodes.length" class="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
          <div class="w-14 h-14 rounded-2xl flex items-center justify-center" style="background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.2);">
            <Icon name="cpu-chip" :size="24" class="text-violet-400" />
          </div>
          <div class="text-sm text-zinc-400">No node connected yet. <router-link to="/settings" class="text-violet-400 hover:text-violet-300">Add one in Settings.</router-link></div>
        </div>

        <div v-else-if="contacts.loading" class="flex items-center justify-center h-32">
          <Spinner />
        </div>

        <div v-else-if="filtered.length === 0 && search" class="flex flex-col items-center justify-center h-32 text-zinc-500 text-sm">
          No contacts match "{{ search }}"
        </div>

        <div v-else-if="nodeFiltered.length === 0" class="flex flex-col items-center justify-center h-full gap-2 px-8 text-center">
          <div class="text-sm text-zinc-500">Listening for contacts on the mesh…</div>
        </div>

        <ul v-else>
          <li
            v-for="c in filtered"
            :key="c.id"
            @click="open(c)"
            class="flex items-center gap-3 px-4 min-h-[56px] border-b border-white/[0.04] cursor-pointer active:bg-white/[0.04] transition-colors hover:bg-white/[0.03]"
          >
            <!-- Avatar -->
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-lg relative"
              :style="{ background: avatarStyle(c) }"
            >
              {{ (c.adv_name || c.short_name || '?')[0].toUpperCase() }}
              <span
                v-if="unread(c) > 0"
                class="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-violet-600 text-white text-[8px] font-bold flex items-center justify-center"
              >{{ unread(c) > 9 ? '9+' : unread(c) }}</span>
            </div>

            <!-- Name + type pill + last seen -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-zinc-100 truncate">{{ c.adv_name || c.short_name || 'Unknown' }}</div>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span :class="['text-[10px] font-medium px-1.5 py-0.5 rounded-md border leading-none', TYPE_META[c.contact_type_name]?.bg || TYPE_META.NONE.bg]">
                  {{ TYPE_META[c.contact_type_name]?.label || c.contact_type_name }}
                </span>
                <span v-if="fmtTime(c.last_heard)" class="text-[10px] text-zinc-600">{{ fmtTime(c.last_heard) }}</span>
              </div>
            </div>

            <!-- Action buttons (hidden on narrow viewports) -->
            <div class="hidden sm:flex items-center gap-1 flex-shrink-0">
              <template v-if="c.contact_type_name === 'REP' || c.contact_type_name === 'SENS'">
                <button
                  @click.stop="doPing($event, c)"
                  :disabled="pingingId === c.id"
                  title="Ping"
                  :class="['w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40', pingingId === c.id ? 'text-cyan-400 animate-pulse' : 'text-zinc-600 hover:text-cyan-400 hover:bg-cyan-500/10']"
                ><Icon name="signal" :size="15" /></button>
                <span
                  v-if="pingResults[c.id] !== undefined && pingResults[c.id] !== null"
                  :class="['text-xs font-mono tabular-nums', pingResults[c.id].success ? 'text-cyan-300' : 'text-rose-400']"
                >{{ pingResults[c.id].success ? pingResults[c.id].latency_ms + 'ms' : 'timeout' }}</span>
              </template>
              <button
                v-if="c.contact_type_name === 'REP'"
                @click.stop="openAdmin($event, c)"
                title="Admin"
                class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-zinc-600 hover:text-violet-400 hover:bg-violet-500/10"
              ><Icon name="cog" :size="15" /></button>
            </div>

            <!-- Fav (always visible) -->
            <button
              @click.stop="toggleFavorite($event, c)"
              :class="['w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0', c.favorite ? 'text-amber-400' : 'text-zinc-700 hover:text-amber-500']"
            ><Icon :name="c.favorite ? 'star-solid' : 'star'" :size="15" /></button>

            <Icon name="chevron-right" :size="14" class="text-zinc-700 flex-shrink-0" />
          </li>
        </ul>
      </div>
    </div>
  `,
})

