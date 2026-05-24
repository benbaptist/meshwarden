import { defineComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useContactsStore } from '../stores/contacts.js'
import { useToast } from '../components/shared/Toast.js'

export default defineComponent({
  name: 'ContactDetail',
  setup() {
    const route = useRoute()
    const contacts = useContactsStore()
    const toast = useToast()

    const contactId = Number(route.params.id)
    const contact = ref(null)
    const history = ref([])
    const telemetry = ref([])
    const signal = ref([])
    const messages = ref([])
    const activeTab = ref('history')
    const newTag = ref('')
    let chart = null
    let signalChart = null

    onMounted(async () => {
      try {
        contact.value = await contacts.fetchOne(contactId)
        await Promise.all([
          contacts.fetchHistory(contactId).then((d) => { history.value = d }),
          contacts.fetchTelemetry(contactId).then((d) => { telemetry.value = d }),
          contacts.fetchSignal(contactId).then((d) => {
            signal.value = d
            renderSignalChart()
          }),
          contacts.fetchMessages(contactId).then((d) => { messages.value = d }),
        ])
      } catch (e) {
        toast.error('Failed to load contact')
      }
    })

    onBeforeUnmount(() => {
      if (chart) chart.destroy()
      if (signalChart) signalChart.destroy()
    })

    function renderSignalChart() {
      const el = document.getElementById('signal-chart')
      if (!el || !signal.value.length || typeof ApexCharts === 'undefined') return
      const data = signal.value.slice().reverse()
      signalChart = new ApexCharts(el, {
        chart: { type: 'line', height: 180, background: 'transparent', toolbar: { show: false }, sparkline: { enabled: false } },
        theme: { mode: 'dark' },
        series: [
          { name: 'SNR (dB)', data: data.map((r) => ({ x: new Date(r.timestamp), y: r.snr })) },
        ],
        xaxis: { type: 'datetime', labels: { style: { colors: '#6b7280', fontSize: '11px' } } },
        yaxis: { labels: { style: { colors: '#6b7280', fontSize: '11px' } } },
        stroke: { width: 2, curve: 'smooth' },
        colors: ['#22c55e'],
        grid: { borderColor: '#1f2937' },
        tooltip: { theme: 'dark' },
      })
      signalChart.render()
    }

    async function requestTelemetry() {
      try {
        await contacts.requestTelemetry(contactId)
        toast.info('Telemetry request sent')
      } catch (e) {
        toast.error(e.message)
      }
    }

    async function addTag() {
      if (!newTag.value.trim() || !contact.value) return
      const tags = [...contact.value.tags, newTag.value.trim()]
      contact.value = await contacts.update(contactId, { tags })
      newTag.value = ''
    }

    async function removeTag(tag) {
      if (!contact.value) return
      const tags = contact.value.tags.filter((t) => t !== tag)
      contact.value = await contacts.update(contactId, { tags })
    }

    function relativeTime(iso) {
      if (!iso) return '—'
      const diff = (Date.now() - new Date(iso)) / 1000
      if (diff < 60) return 'just now'
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
      return new Date(iso).toLocaleDateString()
    }

    const TABS = ['history', 'telemetry', 'signal', 'messages']

    return {
      contact, history, telemetry, signal, messages, activeTab, newTag,
      requestTelemetry, addTag, removeTag, relativeTime, TABS,
    }
  },
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <div v-if="!contact" class="text-gray-500 text-sm">Loading…</div>
      <template v-else>
        <!-- Header -->
        <div class="flex items-start gap-4 mb-6">
          <router-link to="/contacts" class="text-gray-500 hover:text-gray-300 text-sm mt-1">←</router-link>
          <div class="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold text-gray-300 flex-shrink-0">
            {{ (contact.adv_name || '?')[0].toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl font-bold text-white">{{ contact.adv_name || 'Unknown' }}</h1>
            <div class="text-xs text-gray-500 font-mono mt-0.5">{{ contact.public_key }}</div>
            <div class="flex items-center gap-3 mt-2">
              <span class="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{{ contact.contact_type_name }}</span>
              <span v-if="contact.last_advert" class="text-xs text-gray-500">Last heard {{ relativeTime(contact.last_advert) }}</span>
              <span v-if="contact.lat" class="text-xs text-gray-500 font-mono">{{ contact.lat.toFixed(4) }}, {{ contact.lon.toFixed(4) }}</span>
            </div>
          </div>
          <button @click="requestTelemetry" class="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors flex-shrink-0">
            Request Telemetry
          </button>
        </div>

        <!-- Tags -->
        <div class="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6">
          <div class="flex flex-wrap gap-2 mb-3">
            <span
              v-for="tag in contact.tags"
              :key="tag"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-gray-700 text-gray-300"
            >
              {{ tag }}
              <button @click="removeTag(tag)" class="text-gray-500 hover:text-red-400">&times;</button>
            </span>
            <span v-if="!contact.tags.length" class="text-xs text-gray-600">No tags</span>
          </div>
          <form @submit.prevent="addTag" class="flex gap-2">
            <input
              v-model="newTag"
              type="text"
              placeholder="Add tag…"
              class="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-mesh-500 w-40"
            />
            <button type="submit" class="px-3 py-1.5 rounded-lg bg-mesh-700 text-white text-xs hover:bg-mesh-600 transition-colors">Add</button>
          </form>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 mb-4 bg-gray-900 p-1 rounded-xl w-fit border border-gray-800">
          <button
            v-for="tab in TABS"
            :key="tab"
            @click="activeTab = tab"
            :class="['px-4 py-2 rounded-lg text-sm capitalize transition-colors', activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300']"
          >{{ tab }}</button>
        </div>

        <!-- History tab -->
        <div v-if="activeTab === 'history'" class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div v-if="!history.length" class="p-6 text-center text-gray-600 text-sm">No changes recorded yet</div>
          <div v-else class="divide-y divide-gray-800">
            <div v-for="entry in history" :key="entry.id" class="px-5 py-3 flex items-start gap-4 text-sm">
              <div class="text-xs text-gray-600 w-36 flex-shrink-0 mt-0.5">{{ new Date(entry.timestamp).toLocaleString() }}</div>
              <div class="flex-1">
                <span class="text-gray-400">{{ entry.field_name }}</span>
                <span class="text-gray-600 mx-2">→</span>
                <span class="text-red-400 line-through mr-2">{{ entry.old_value || '—' }}</span>
                <span class="text-green-400">{{ entry.new_value || '—' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Telemetry tab -->
        <div v-if="activeTab === 'telemetry'" class="space-y-3">
          <div v-if="!telemetry.length" class="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center text-gray-600 text-sm">No telemetry recorded yet</div>
          <div v-for="rec in telemetry" :key="rec.id" class="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div class="text-xs text-gray-500 mb-3">{{ new Date(rec.timestamp).toLocaleString() }}</div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div v-for="(val, key) in rec.lpp_data" :key="key" class="bg-gray-800 rounded-lg p-3">
                <div class="text-xs text-gray-500 mb-1 capitalize">{{ key.replace(/_/g, ' ') }}</div>
                <div class="text-white text-sm font-mono">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Signal tab -->
        <div v-if="activeTab === 'signal'" class="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div v-if="!signal.length" class="text-center text-gray-600 text-sm py-6">No signal data yet</div>
          <div id="signal-chart"></div>
        </div>

        <!-- Messages tab -->
        <div v-if="activeTab === 'messages'" class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div v-if="!messages.length" class="p-6 text-center text-gray-600 text-sm">No messages yet</div>
          <div v-else class="divide-y divide-gray-800">
            <div v-for="msg in messages" :key="msg.id" class="px-5 py-3 flex items-start gap-4 text-sm">
              <span :class="['text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5', msg.direction === 'in' ? 'bg-blue-900 text-blue-400' : 'bg-gray-800 text-gray-400']">
                {{ msg.direction.toUpperCase() }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-gray-200">{{ msg.text }}</div>
                <div class="flex items-center gap-3 mt-1">
                  <span class="text-xs text-gray-600">{{ new Date(msg.timestamp).toLocaleString() }}</span>
                  <SignalBadge v-if="msg.snr != null" :snr="msg.snr" :rssi="msg.rssi" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  `,
})
