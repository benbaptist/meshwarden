import { defineComponent, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useContactsStore } from '../stores/contacts.js'
import { useNodesStore } from '../stores/nodes.js'
import { useMessagesStore } from '../stores/messages.js'
import { useGroupsStore } from '../stores/groups.js'

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

    const search = ref('')
    const sortKey = ref('adv_name')
    const sortAsc = ref(true)
    const activeGroupId = ref(null)

    onMounted(async () => {
      if (!contacts.contacts.length) await contacts.fetchAll()
      if (!groups.groups.length) await groups.fetchAll()
    })

    function sort(key) {
      if (sortKey.value === key) { sortAsc.value = !sortAsc.value }
      else { sortKey.value = key; sortAsc.value = true }
    }

    async function selectGroup(id) {
      activeGroupId.value = id
      if (id === null) await contacts.fetchAll()
      else await contacts.fetchAll({ group_id: id })
    }

    async function toggleFavorite(e, c) {
      e.stopPropagation()
      await contacts.toggleFavorite(c.id)
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
        // Favorites always bubble to the top regardless of sort
        if (a.favorite && !b.favorite) return -1
        if (!a.favorite && b.favorite) return 1
        let va = a[sortKey.value] ?? ''
        let vb = b[sortKey.value] ?? ''
        if (sortKey.value === 'last_heard') {
          va = va ? new Date(va).getTime() : 0
          vb = vb ? new Date(vb).getTime() : 0
        } else {
          va = String(va).toLowerCase()
          vb = String(vb).toLowerCase()
        }
        if (va < vb) return sortAsc.value ? -1 : 1
        if (va > vb) return sortAsc.value ? 1 : -1
        return 0
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
      if (!ts) return '—'
      const d = new Date(ts)
      const diff = (Date.now() - d) / 1000
      if (diff < 60) return 'now'
      if (diff < 3600) return `${Math.floor(diff / 60)}m`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h`
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }

    function open(c) { router.push(`/contacts/${c.id}`) }

    return {
      contacts, nodes, groups, search, sortKey, sortAsc, activeGroupId,
      filtered, nodeFiltered, sort, selectGroup, toggleFavorite, unread, avatarStyle, fmtTime, open,
      TYPE_META,
    }
  },
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="flex-shrink-0 px-4 pt-5 pb-3 border-b border-white/[0.06]" style="background: rgba(9,9,15,0.6); backdrop-filter: blur(12px);">
        <h1 class="text-lg font-bold text-white mb-3">Contacts</h1>

        <!-- Search -->
        <div class="relative mb-3">
          <Icon name="users" :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            v-model="search"
            type="text"
            placeholder="Search contacts…"
            class="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all"
            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
          />
        </div>

        <!-- Group filter chips -->
        <div v-if="groups.groups.length" class="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <button
            @click="selectGroup(null)"
            :class="[
              'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all border',
              activeGroupId === null
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
              activeGroupId === g.id
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                : 'text-zinc-500 border-white/[0.08] hover:text-zinc-300 hover:border-white/[0.15]'
            ]"
          >{{ g.name }}</button>
        </div>
      </div>

      <!-- Sort bar — hidden on mobile -->
      <div class="hidden sm:flex flex-shrink-0 px-4 py-2 border-b border-white/[0.04] text-xs text-zinc-600">
        <div class="flex-1">
          <button @click="sort('adv_name')" class="flex items-center gap-1 hover:text-zinc-400 transition-colors">
            Name
            <Icon v-if="sortKey==='adv_name'" :name="sortAsc ? 'chevron-up' : 'chevron-down'" :size="11" class="text-violet-400" />
          </button>
        </div>
        <div class="w-24">
          <button @click="sort('contact_type_name')" class="flex items-center gap-1 hover:text-zinc-400 transition-colors">
            Type
            <Icon v-if="sortKey==='contact_type_name'" :name="sortAsc ? 'chevron-up' : 'chevron-down'" :size="11" class="text-violet-400" />
          </button>
        </div>
        <div class="w-20 text-right">
          <button @click="sort('last_heard')" class="flex items-center gap-1 justify-end hover:text-zinc-400 transition-colors ml-auto">
            Seen
            <Icon v-if="sortKey==='last_heard'" :name="sortAsc ? 'chevron-up' : 'chevron-down'" :size="11" class="text-violet-400" />
          </button>
        </div>
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

        <div v-else>
          <button
            v-for="c in filtered"
            :key="c.id"
            @click="open(c)"
            class="w-full flex items-center gap-3.5 px-4 py-3.5 border-b border-white/[0.04] text-left transition-colors active:bg-white/[0.04] hover:bg-white/[0.03] min-h-[56px]"
          >
            <div
              class="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-lg"
              :style="{ background: avatarStyle(c) }"
            >{{ (c.adv_name || c.short_name || '?')[0].toUpperCase() }}</div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-white truncate">{{ c.adv_name || c.short_name || 'Unknown' }}</span>
                <span
                  v-if="unread(c) > 0"
                  class="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center"
                >{{ unread(c) > 9 ? '9+' : unread(c) }}</span>
              </div>
              <span
                :class="['mt-0.5 inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-md border', TYPE_META[c.contact_type_name]?.bg || TYPE_META.NONE.bg]"
              >{{ TYPE_META[c.contact_type_name]?.label || c.contact_type_name }}</span>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                @click.stop="toggleFavorite($event, c)"
                :class="['transition-colors', c.favorite ? 'text-amber-400' : 'text-zinc-700 hover:text-amber-500']"
              ><Icon name="star" :size="15" /></button>
              <span class="text-xs text-zinc-600">{{ fmtTime(c.last_heard) }}</span>
              <Icon name="chevron-right" :size="15" class="text-zinc-700" />
            </div>
          </button>
        </div>
      </div>
    </div>
  `,
})
