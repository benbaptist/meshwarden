import { defineComponent, ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContactsStore } from '../stores/contacts.js'
import { useMessagesStore } from '../stores/messages.js'
import { useNodesStore } from '../stores/nodes.js'
import { useToast } from '../components/shared/Toast.js'

const TYPE_META = {
  CLI:  { label: 'Client',   cls: 'bg-violet-500/15 border-violet-500/20 text-violet-300' },
  REP:  { label: 'Repeater', cls: 'bg-cyan-500/15 border-cyan-500/20 text-cyan-300' },
  ROOM: { label: 'Room',     cls: 'bg-amber-500/15 border-amber-500/20 text-amber-300' },
  SENS: { label: 'Sensor',   cls: 'bg-emerald-500/15 border-emerald-500/20 text-emerald-300' },
  NONE: { label: 'Unknown',  cls: 'bg-zinc-500/15 border-zinc-500/20 text-zinc-400' },
}

const GRADIENTS = [
  ['#7c3aed', '#4f46e5'], ['#0e7490', '#0891b2'], ['#d97706', '#b45309'],
  ['#059669', '#047857'], ['#be185d', '#9d174d'], ['#6d28d9', '#7c3aed'],
]
function nameHash(name) {
  let h = 0; for (const c of (name || '?')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h
}

export default defineComponent({
  name: 'ContactDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const contacts = useContactsStore()
    const messages = useMessagesStore()
    const nodes = useNodesStore()
    const toast = useToast()

    const contactId = Number(route.params.id)
    const threadKey = `direct-${contactId}`

    const contact = ref(null)
    const history = ref([])
    const signal = ref([])
    const activeTab = ref('chat')
    const text = ref('')
    const sending = ref(false)
    const threadRef = ref(null)
    const newTag = ref('')
    let signalChart = null

    const thread = computed(() => messages.threads[threadKey] || [])
    const sortedThread = computed(() => [...thread.value].reverse())

    async function load() {
      try {
        contact.value = await contacts.fetchOne(contactId)
        messages.clearUnread(threadKey)
        await Promise.all([
          contacts.fetchHistory(contactId).then((d) => { history.value = d }),
          contacts.fetchSignal(contactId).then((d) => { signal.value = d }),
          messages.fetchThread(threadKey, { contact_id: contactId, msg_type: 'direct' }),
        ])
        await nextTick()
        scrollThread()
      } catch {
        toast.error('Failed to load contact')
      }
    }

    function scrollThread() {
      if (threadRef.value) threadRef.value.scrollTop = threadRef.value.scrollHeight
    }

    async function send() {
      if (!text.value.trim() || sending.value) return
      sending.value = true
      try {
        await messages.send({
          node_id: contact.value?.node_id || nodes.activeNodeId,
          msg_type: 'direct',
          contact_id: contactId,
          text: text.value.trim(),
        })
        text.value = ''
        await nextTick()
        scrollThread()
      } catch (e) {
        toast.error(e.message || 'Failed to send')
      } finally {
        sending.value = false
      }
    }

    function onKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
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

    function renderSignalChart() {
      const el = document.getElementById('signal-chart')
      if (!el || !signal.value.length || typeof ApexCharts === 'undefined') return
      const data = signal.value.slice().reverse()
      signalChart = new ApexCharts(el, {
        chart: { type: 'line', height: 160, background: 'transparent', toolbar: { show: false } },
        theme: { mode: 'dark' },
        series: [{ name: 'SNR (dB)', data: data.map((r) => ({ x: new Date(r.timestamp), y: r.snr })) }],
        xaxis: { type: 'datetime', labels: { style: { colors: '#52525b', fontSize: '10px' } } },
        yaxis: { labels: { style: { colors: '#52525b', fontSize: '10px' } } },
        stroke: { width: 2, curve: 'smooth' },
        colors: ['#a78bfa'],
        grid: { borderColor: '#27272a' },
        tooltip: { theme: 'dark' },
      })
      signalChart.render()
    }

    watch(activeTab, (tab) => {
      if (tab === 'activity') nextTick(renderSignalChart)
      if (tab === 'chat') nextTick(scrollThread)
    })

    watch(thread, () => nextTick(scrollThread))

    function fmtTime(ts) {
      if (!ts) return '—'
      const d = new Date(ts)
      const diff = (Date.now() - d) / 1000
      if (diff < 60) return 'now'
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
      return d.toLocaleDateString()
    }

    function avatarStyle(c) {
      const name = c?.adv_name || c?.short_name || '?'
      const [from, to] = GRADIENTS[nameHash(name) % GRADIENTS.length]
      return `linear-gradient(135deg, ${from}, ${to})`
    }

    onMounted(load)
    onBeforeUnmount(() => { if (signalChart) signalChart.destroy() })

    return {
      contact, history, signal, thread, sortedThread, activeTab, text, sending,
      threadRef, newTag, send, onKeydown, addTag, removeTag, fmtTime, avatarStyle,
      router, TYPE_META,
    }
  },
  template: `
    <div class="h-full flex flex-col">
      <!-- Loading -->
      <div v-if="!contact" class="flex items-center justify-center h-full"><Spinner /></div>

      <template v-else>
        <!-- Header bar -->
        <div
          class="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]"
          style="background: rgba(9,9,15,0.7); backdrop-filter: blur(16px);"
        >
          <button @click="router.push('/contacts')" class="text-zinc-500 hover:text-zinc-200 transition-colors">
            <Icon name="chevron-left" :size="22" />
          </button>

          <div
            class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
            :style="{ background: avatarStyle(contact) }"
          >{{ (contact.adv_name || contact.short_name || '?')[0].toUpperCase() }}</div>

          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-white truncate">{{ contact.adv_name || contact.short_name || 'Unknown' }}</div>
            <span
              :class="['text-[10px] font-medium px-1.5 py-0.5 rounded-md border', TYPE_META[contact.contact_type_name]?.cls || TYPE_META.NONE.cls]"
            >{{ TYPE_META[contact.contact_type_name]?.label || contact.contact_type_name }}</span>
          </div>

          <!-- Tab switcher (mobile) -->
          <div class="flex gap-1 md:hidden" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 3px;">
            <button
              v-for="t in ['chat','info','activity']"
              :key="t"
              @click="activeTab = t"
              :class="['px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-all', activeTab === t ? 'bg-violet-600 text-white' : 'text-zinc-500']"
            >{{ t }}</button>
          </div>
        </div>

        <!-- Body: two-panel on desktop, tab-based on mobile -->
        <div class="flex flex-1 min-h-0">

          <!-- Info panel: visible on desktop always; on mobile only when tab=info -->
          <div
            :class="[
              'flex-col border-r border-white/[0.05] overflow-y-auto scrollbar-none',
              activeTab === 'info' ? 'flex flex-1' : 'hidden',
              'md:flex md:flex-initial md:w-72 md:flex-shrink-0'
            ]"
            style="background: rgba(9,9,15,0.4);"
          >
            <!-- Contact card -->
            <div class="p-5 border-b border-white/[0.05]">
              <div
                class="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl mb-3 shadow-lg"
                :style="{ background: avatarStyle(contact) }"
              >{{ (contact.adv_name || '?')[0].toUpperCase() }}</div>
              <div class="text-base font-bold text-white">{{ contact.adv_name || 'Unknown' }}</div>
              <div v-if="contact.short_name" class="text-xs text-zinc-500 mt-0.5">{{ contact.short_name }}</div>
              <div class="text-[10px] text-zinc-700 font-mono mt-1 break-all">{{ contact.public_key }}</div>
            </div>

            <!-- Fields -->
            <div class="px-5 py-4 space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-zinc-500">Last heard</span>
                <span class="text-zinc-200">{{ fmtTime(contact.last_heard) }}</span>
              </div>
              <div v-if="contact.lat" class="flex justify-between text-sm">
                <span class="text-zinc-500">Location</span>
                <span class="text-zinc-200 font-mono text-xs">{{ contact.lat.toFixed(4) }}, {{ contact.lon.toFixed(4) }}</span>
              </div>
              <div v-if="contact.notes" class="text-xs text-zinc-400 leading-relaxed">{{ contact.notes }}</div>
            </div>

            <!-- Tags -->
            <div class="px-5 pb-4 border-t border-white/[0.04] pt-4">
              <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Tags</div>
              <div class="flex flex-wrap gap-1.5 mb-3">
                <span
                  v-for="tag in contact.tags"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-zinc-800 text-zinc-300 border border-white/[0.06]"
                >
                  {{ tag }}
                  <button @click="removeTag(tag)" class="text-zinc-600 hover:text-rose-400 transition-colors">&times;</button>
                </span>
                <span v-if="!contact.tags?.length" class="text-xs text-zinc-700">None</span>
              </div>
              <form @submit.prevent="addTag" class="flex gap-2">
                <input
                  v-model="newTag"
                  type="text"
                  placeholder="Add tag…"
                  class="flex-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
                />
                <button
                  type="submit"
                  class="px-3 py-1.5 rounded-lg text-xs text-white transition-colors"
                  style="background: rgba(139,92,246,0.3); border: 1px solid rgba(139,92,246,0.4);"
                >Add</button>
              </form>
            </div>
          </div>

          <!-- Activity panel: mobile only (history tab) -->
          <div
            :class="[
              'flex-col flex-1 overflow-y-auto scrollbar-none px-4 py-4 space-y-3',
              activeTab === 'activity' ? 'flex' : 'hidden'
            ]"
          >
            <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">Signal History</div>
            <div v-if="!signal.length" class="text-sm text-zinc-600 py-4 text-center">No signal data yet.</div>
            <div v-else id="signal-chart" class="rounded-xl overflow-hidden" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"></div>

            <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mt-4 mb-1">Change History</div>
            <div v-if="!history.length" class="text-sm text-zinc-600 py-4 text-center">No changes recorded.</div>
            <div
              v-for="entry in history"
              :key="entry.id"
              class="flex items-start gap-3 text-xs py-2 border-b border-white/[0.04]"
            >
              <span class="text-zinc-700 flex-shrink-0 w-28">{{ new Date(entry.timestamp).toLocaleString() }}</span>
              <span class="text-zinc-500">{{ entry.field_name }}</span>
              <span class="text-rose-400 line-through">{{ entry.old_value || '—' }}</span>
              <span class="text-emerald-400">{{ entry.new_value || '—' }}</span>
            </div>
          </div>

          <!-- Chat panel: always on desktop, mobile only when tab=chat -->
          <div
            :class="[
              'flex-col flex-1 min-w-0',
              activeTab === 'chat' ? 'flex' : 'hidden',
              'md:flex'
            ]"
          >
            <!-- Thread -->
            <div ref="threadRef" class="flex-1 overflow-y-auto scrollbar-none px-4 py-4 space-y-2.5">
              <div v-if="!sortedThread.length" class="flex items-center justify-center h-full">
                <div class="text-center">
                  <div class="text-zinc-600 text-sm">No messages yet</div>
                  <div class="text-zinc-700 text-xs mt-1">Start a conversation below</div>
                </div>
              </div>
              <div
                v-for="msg in sortedThread"
                :key="msg.id"
                :class="['flex', msg.direction === 'out' ? 'justify-end' : 'justify-start']"
              >
                <div
                  :class="['max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed', msg.direction === 'out' ? 'rounded-br-md' : 'rounded-bl-md glass']"
                  :style="msg.direction === 'out' ? 'background: linear-gradient(135deg, #7c3aed, #9333ea); color: white;' : 'color: #e4e4e7;'"
                >
                  <div>{{ msg.text }}</div>
                  <div class="flex items-center gap-1.5 mt-1" :class="msg.direction === 'out' ? 'justify-end' : 'justify-start'">
                    <span class="text-[10px] opacity-60">{{ new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }}</span>
                    <template v-if="msg.direction === 'out'">
                      <Icon v-if="msg.status === 'ack'" name="check-circle" :size="11" class="opacity-70" />
                      <Icon v-else-if="msg.status === 'sent'" name="check" :size="11" class="opacity-50" />
                      <Icon v-else name="clock" :size="11" class="opacity-40" />
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- Compose -->
            <div
              class="flex-shrink-0 px-4 py-3 border-t border-white/[0.06] flex gap-2 items-end"
              style="background: rgba(9,9,15,0.5); backdrop-filter: blur(12px);"
            >
              <textarea
                v-model="text"
                @keydown="onKeydown"
                placeholder="Message… (Enter to send)"
                rows="1"
                class="flex-1 resize-none px-3.5 py-2.5 rounded-2xl text-sm text-zinc-100 placeholder-zinc-600 outline-none max-h-32 overflow-y-auto"
                style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);"
              ></textarea>
              <button
                @click="send"
                :disabled="!text.trim() || sending"
                class="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40"
                style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
              >
                <Icon name="send" :size="16" class="text-white" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  `,
})

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
