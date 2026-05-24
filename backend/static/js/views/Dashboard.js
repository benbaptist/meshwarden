import { defineComponent, computed, onMounted } from 'vue'
import { useNodesStore } from '../stores/nodes.js'
import { useContactsStore } from '../stores/contacts.js'
import { useMessagesStore } from '../stores/messages.js'

export default defineComponent({
  name: 'Dashboard',
  setup() {
    const nodes = useNodesStore()
    const contacts = useContactsStore()
    const messages = useMessagesStore()

    onMounted(() => {
      if (!nodes.nodes.length) nodes.fetchAll()
      if (!contacts.contacts.length) contacts.fetchAll()
    })

    const recentMessages = computed(() => {
      const all = Object.values(messages.threads).flat()
      return all
        .slice()
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10)
    })

    const recentContacts = computed(() =>
      contacts.contacts
        .filter((c) => c.last_advert)
        .slice()
        .sort((a, b) => new Date(b.last_advert) - new Date(a.last_advert))
        .slice(0, 8)
    )

    function relativeTime(iso) {
      if (!iso) return '—'
      const diff = (Date.now() - new Date(iso)) / 1000
      if (diff < 60) return 'just now'
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
      return `${Math.floor(diff / 86400)}d ago`
    }

    return { nodes, contacts, recentMessages, recentContacts, relativeTime }
  },
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <h1 class="text-2xl font-bold text-white mb-6">Dashboard</h1>

      <!-- Node cards -->
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Nodes</h2>
        <div v-if="nodes.loading" class="text-gray-500 text-sm">Loading…</div>
        <div v-else-if="!nodes.nodes.length" class="rounded-xl border border-dashed border-gray-700 p-8 text-center">
          <p class="text-gray-500 mb-3">No nodes configured yet.</p>
          <router-link to="/nodes" class="text-mesh-400 hover:text-mesh-300 text-sm">Add a node →</router-link>
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <router-link
            v-for="node in nodes.nodes"
            :key="node.id"
            :to="\`/nodes/\${node.id}\`"
            class="block bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors"
          >
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="font-semibold text-white">{{ node.name }}</div>
                <div class="text-xs text-gray-500 mt-0.5">
                  {{ node.connection_type === 'tcp' ? node.host + ':' + node.port : node.device_path }}
                </div>
              </div>
              <span :class="['w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0', node.connected ? 'bg-green-500' : 'bg-gray-600']"></span>
            </div>
            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span>{{ node.connected ? 'Online' : 'Offline' }}</span>
              <span v-if="node.last_seen">Last seen {{ relativeTime(node.last_seen) }}</span>
            </div>
          </router-link>
        </div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent messages -->
        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Messages</h2>
            <router-link to="/chat" class="text-xs text-mesh-400 hover:text-mesh-300">View all →</router-link>
          </div>
          <div class="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            <div v-if="!recentMessages.length" class="p-6 text-center text-gray-600 text-sm">No messages yet</div>
            <div v-for="msg in recentMessages" :key="msg.id" class="px-4 py-3 flex items-start gap-3">
              <span :class="['flex-shrink-0 mt-0.5', msg.msg_type === 'channel' ? 'text-purple-400' : 'text-mesh-500']"><Icon :name="'chat'" :size="16" /></span>
              <div class="min-w-0 flex-1">
                <div class="text-sm text-gray-200 truncate">{{ msg.text }}</div>
                <div class="text-xs text-gray-500 mt-0.5">{{ relativeTime(msg.timestamp) }}</div>
              </div>
              <span :class="['text-xs px-1.5 py-0.5 rounded flex-shrink-0', msg.direction === 'in' ? 'bg-blue-900 text-blue-400' : 'bg-gray-800 text-gray-400']">
                {{ msg.direction === 'in' ? 'RX' : 'TX' }}
              </span>
            </div>
          </div>
        </section>

        <!-- Recently heard contacts -->
        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recently Heard</h2>
            <router-link to="/contacts" class="text-xs text-mesh-400 hover:text-mesh-300">View all →</router-link>
          </div>
          <div class="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            <div v-if="!recentContacts.length" class="p-6 text-center text-gray-600 text-sm">No contacts yet</div>
            <router-link
              v-for="c in recentContacts"
              :key="c.id"
              :to="\`/contacts/\${c.id}\`"
              class="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
            >
              <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
                {{ (c.adv_name || '?')[0].toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-white truncate">{{ c.adv_name || c.public_key.slice(0,12) }}</div>
                <div class="text-xs text-gray-500">{{ c.contact_type_name }} &middot; {{ relativeTime(c.last_advert) }}</div>
              </div>
            </router-link>
          </div>
        </section>
      </div>
    </div>
  `,
})
