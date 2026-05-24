import { defineComponent, ref, computed, onMounted } from 'vue'
import { useContactsStore } from '../stores/contacts.js'
import { useNodesStore } from '../stores/nodes.js'

export default defineComponent({
  name: 'Contacts',
  setup() {
    const contacts = useContactsStore()
    const nodes = useNodesStore()

    const search = ref('')
    const filterNodeId = ref(null)

    onMounted(() => {
      if (!contacts.contacts.length) contacts.fetchAll()
    })

    const filtered = computed(() => {
      let list = contacts.contacts
      if (filterNodeId.value) list = list.filter((c) => c.node_id === filterNodeId.value)
      if (search.value.trim()) {
        const q = search.value.toLowerCase()
        list = list.filter((c) => (c.adv_name || '').toLowerCase().includes(q) || c.public_key.includes(q))
      }
      return list.slice().sort((a, b) => new Date(b.last_advert || 0) - new Date(a.last_advert || 0))
    })

    const TYPE_LABELS = { NONE: 'None', CLI: 'Client', REP: 'Repeater', ROOM: 'Room', SENS: 'Sensor' }
    const TYPE_ICONS  = { NONE: 'user', CLI: 'user', REP: 'signal', ROOM: 'home', SENS: 'chart-bar' }

    function relativeTime(iso) {
      if (!iso) return '—'
      const diff = (Date.now() - new Date(iso)) / 1000
      if (diff < 60) return 'just now'
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
      return `${Math.floor(diff / 86400)}d ago`
    }

    return { contacts, nodes, search, filterNodeId, filtered, TYPE_ICONS, TYPE_LABELS, relativeTime }
  },
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="px-4 pt-6 pb-2 flex items-center justify-between flex-shrink-0">
        <h1 class="text-2xl font-bold text-white">Contacts</h1>
        <span class="text-sm text-gray-500">{{ filtered.length }}</span>
      </div>

      <!-- Filters -->
      <div class="px-4 pb-3 flex gap-2 flex-shrink-0">
        <input
          v-model="search"
          type="search"
          placeholder="Search by name or key…"
          class="flex-1 px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-mesh-500 transition-colors"
        />
        <select
          v-model="filterNodeId"
          class="px-3 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-300 focus:outline-none focus:border-mesh-500"
        >
          <option :value="null">All nodes</option>
          <option v-for="n in nodes.nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="contacts.loading" class="py-16 text-center text-gray-600 text-sm">Loading…</div>
        <div v-else-if="!filtered.length" class="py-16 text-center text-gray-600 text-sm">No contacts found</div>
        <router-link
          v-else
          v-for="c in filtered"
          :key="c.id"
          :to="\`/contacts/\${c.id}\`"
          class="flex items-center gap-3.5 px-4 py-4 border-b border-gray-800/60 hover:bg-gray-900/50 active:bg-gray-900 transition-colors"
        >
          <div class="w-11 h-11 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-200 flex-shrink-0">
            {{ (c.adv_name || '?')[0].toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-white truncate">{{ c.adv_name || '—' }}</div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <Icon :name="TYPE_ICONS[c.contact_type_name] || 'user'" :size="11" class="text-gray-500 flex-shrink-0" />
              <span class="text-xs text-gray-500">{{ TYPE_LABELS[c.contact_type_name] || c.contact_type_name }}</span>
              <span class="text-gray-700">·</span>
              <span class="text-xs text-gray-600 flex-shrink-0">{{ relativeTime(c.last_advert) }}</span>
            </div>
          </div>
          <Icon name="arrow-right" :size="16" class="text-gray-700 flex-shrink-0" />
        </router-link>
      </div>
    </div>
  `,
})
