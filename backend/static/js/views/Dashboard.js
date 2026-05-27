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
    <div class="px-4 pt-6 pb-4 max-w-3xl mx-auto">
      <h1 class="text-2xl font-bold text-white mb-6">Dashboard</h1>

      <!-- Node cards -->
      <section class="mb-6">
        <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-0.5">Nodes</h2>
        <div v-if="nodes.loading" class="text-zinc-600 text-sm py-4">Loading…</div>
        <div v-else-if="!nodes.nodes.length" class="rounded-2xl border border-dashed border-white/[0.1] p-8 text-center">
          <p class="text-zinc-500 mb-3 text-sm">No nodes configured yet.</p>
          <router-link to="/nodes" class="text-mesh-400 hover:text-mesh-300 text-sm flex items-center justify-center gap-1">
            Add a node <Icon name="arrow-right" :size="13" />
          </router-link>
        </div>
        <div v-else class="space-y-2.5">
          <router-link
            v-for="node in nodes.nodes"
            :key="node.id"
            :to="\`/nodes/\${node.id}\`"
            class="flex items-center gap-3.5 px-4 py-4 rounded-2xl glass transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]"
          >
            <div :class="['w-2.5 h-2.5 rounded-full flex-shrink-0', node.connected ? 'bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.35)]' : 'bg-zinc-600']"></div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-white truncate">{{ node.name }}</div>
              <div class="text-xs text-zinc-500 mt-0.5 truncate">
                {{ node.connection_type === 'tcp' ? node.host + ':' + node.port : node.device_path }}
              </div>
            </div>
            <span :class="['text-xs font-medium flex-shrink-0', node.connected ? 'text-green-500' : 'text-zinc-600']">
              {{ node.connected ? 'Online' : 'Offline' }}
            </span>
            <Icon name="arrow-right" :size="14" class="text-zinc-700 flex-shrink-0" />
          </router-link>
        </div>
      </section>

      <!-- Recent messages -->
      <section class="mb-6">
        <div class="flex items-center justify-between mb-3 px-0.5">
          <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recent Messages</h2>
          <router-link to="/chat" class="flex items-center gap-0.5 text-xs text-mesh-400 hover:text-mesh-300">
            All <Icon name="arrow-right" :size="12" />
          </router-link>
        </div>
        <div class="rounded-2xl overflow-hidden divide-y divide-white/[0.04]" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);">
          <div v-if="!recentMessages.length" class="p-6 text-center text-zinc-600 text-sm">No messages yet</div>
          <div v-for="msg in recentMessages" :key="msg.id" class="flex items-start gap-3 px-4 py-3">
            <span :class="['flex-shrink-0 mt-0.5', msg.direction === 'in' ? 'text-mesh-500' : 'text-zinc-600']">
              <Icon name="chat" :size="15" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-sm text-zinc-200 truncate">{{ msg.text }}</div>
              <div class="text-xs text-zinc-600 mt-0.5">{{ relativeTime(msg.timestamp) }}</div>
            </div>
            <span :class="['text-xs px-1.5 py-0.5 rounded flex-shrink-0 font-mono', msg.direction === 'in' ? 'bg-violet-500/15 text-violet-400' : 'bg-white/[0.05] text-zinc-500']">
              {{ msg.direction === 'in' ? 'RX' : 'TX' }}
            </span>
          </div>
        </div>
      </section>

      <!-- Recently heard contacts -->
      <section>
        <div class="flex items-center justify-between mb-3 px-0.5">
          <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recently Heard</h2>
          <router-link to="/contacts" class="flex items-center gap-0.5 text-xs text-mesh-400 hover:text-mesh-300">
            All <Icon name="arrow-right" :size="12" />
          </router-link>
        </div>
        <div class="rounded-2xl overflow-hidden divide-y divide-white/[0.04]" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);">
          <div v-if="!recentContacts.length" class="p-6 text-center text-zinc-600 text-sm">No contacts yet</div>
          <router-link
            v-for="c in recentContacts"
            :key="c.id"
            :to="\`/contacts/\${c.id}\`"
            class="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors"
          >
            <div class="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0">
              {{ (c.adv_name || '?')[0].toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-white truncate">{{ c.adv_name || c.public_key.slice(0,12) }}</div>
              <div class="text-xs text-zinc-500">{{ c.contact_type_name }} · {{ relativeTime(c.last_advert) }}</div>
            </div>
            <Icon name="arrow-right" :size="14" class="text-zinc-700 flex-shrink-0" />
          </router-link>
        </div>
      </section>
    </div>
  `,
})
