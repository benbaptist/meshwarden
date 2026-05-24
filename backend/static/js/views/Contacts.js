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

    return { contacts, nodes, search, filterNodeId, filtered, TYPE_ICONS, relativeTime }
  },
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-white">Contacts</h1>
        <span class="text-sm text-gray-500">{{ filtered.length }} contact{{ filtered.length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Filters -->
      <div class="flex gap-3 mb-5">
        <input
          v-model="search"
          type="text"
          placeholder="Search by name or key…"
          class="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-mesh-500 transition-colors"
        />
        <select
          v-model="filterNodeId"
          class="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 focus:outline-none focus:border-mesh-500"
        >
          <option :value="null">All nodes</option>
          <option v-for="n in nodes.nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
      </div>

      <!-- Table -->
      <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div v-if="contacts.loading" class="p-8 text-center text-gray-500 text-sm">Loading…</div>
        <div v-else-if="!filtered.length" class="p-8 text-center text-gray-600 text-sm">No contacts found</div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th class="text-left px-5 py-3">Contact</th>
              <th class="text-left px-4 py-3">Type</th>
              <th class="text-left px-4 py-3">Last Heard</th>
              <th class="text-left px-4 py-3">Location</th>
              <th class="text-left px-4 py-3">Tags</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <tr
              v-for="c in filtered"
              :key="c.id"
              class="hover:bg-gray-800/50 transition-colors"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
                    {{ (c.adv_name || '?')[0].toUpperCase() }}
                  </div>
                  <div>
                    <div class="font-medium text-white">{{ c.adv_name || '—' }}</div>
                    <div class="text-xs text-gray-600 font-mono">{{ c.public_key.slice(0, 16) }}…</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="text-gray-300">{{ TYPE_ICONS[c.contact_type_name] || '○' }} {{ c.contact_type_name }}</span>
              </td>
              <td class="px-4 py-3 text-gray-400">{{ relativeTime(c.last_advert) }}</td>
              <td class="px-4 py-3 text-gray-400 font-mono text-xs">
                <span v-if="c.lat && c.lon">{{ c.lat.toFixed(4) }}, {{ c.lon.toFixed(4) }}</span>
                <span v-else>—</span>
              </td>
              <td class="px-4 py-3">
                <span
                  v-for="tag in c.tags"
                  :key="tag"
                  class="inline-block mr-1 px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300"
                >{{ tag }}</span>
              </td>
              <td class="px-4 py-3 text-right">
                <router-link :to="\`/contacts/\${c.id}\`" class="flex items-center gap-1 text-mesh-400 hover:text-mesh-300 text-xs transition-colors">
                  View <Icon name="arrow-right" :size="12" />
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
})
