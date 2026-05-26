import { defineComponent, ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContactsStore } from '../stores/contacts.js'
import { useMessagesStore } from '../stores/messages.js'
import { useNodesStore } from '../stores/nodes.js'
import { useGroupsStore } from '../stores/groups.js'
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
    const groupsStore = useGroupsStore()
    const toast = useToast()

    const contactId = Number(route.params.id)
    const threadKey = `direct-${contactId}`

    const contact = ref(null)
    const history = ref([])
    const signal = ref([])
    const telemetry = ref([])
    const activeTab = ref(['chat', 'info', 'activity'].includes(route.query.tab) ? route.query.tab : 'chat')
    const sending = ref(false)
    const contactGroups = ref([])
    const newGroupName = ref('')
    const selectedGroupId = ref('')
    const pinging = ref(false)
    const pingResult = ref(null)  // null | { success, latency_ms }
    const pings = ref([])
    const adminPassword = ref('')
    const adminLoggingIn = ref(false)
    const loggedIn = ref(false)
    const newPath = ref('')
    const settingPath = ref(false)
    let signalChart = null

    const thread = computed(() => messages.threads[threadKey] || [])

    const isRepeater = computed(() => contact.value?.contact_type_name === 'REP')
    const isSensor = computed(() => contact.value?.contact_type_name === 'SENS')
    const availableGroups = computed(() =>
      groupsStore.groups.filter((g) => !contactGroups.value.find((cg) => cg.id === g.id))
    )

    // Parse out_path hex into 4-byte hops, try to match to known contacts
    const pathHops = computed(() => {
      const raw = contact.value?.out_path
      if (!raw) return []
      // Normalize: if it's a non-hex string (binary), convert to hex
      let hex = raw
      if (!/^[0-9a-fA-F]*$/.test(raw)) {
        hex = Array.from(raw).map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
      }
      if (!hex || hex.length < 8) return []
      const hops = []
      for (let i = 0; i < hex.length; i += 8) {
        const hopHex = hex.slice(i, i + 8)
        if (hopHex.length < 8) break
        const matched = contacts.contacts.find((c) => c.public_key.toLowerCase().startsWith(hopHex.toLowerCase()))
        hops.push({ hex: hopHex, name: matched?.adv_name || null })
      }
      return hops
    })

    async function load() {
      try {
        contact.value = await contacts.fetchOne(contactId)
        messages.clearUnread(threadKey)
        const fetches = [
          contacts.fetchHistory(contactId).then((d) => { history.value = d }),
          contacts.fetchSignal(contactId).then((d) => { signal.value = d }),
          contacts.fetchPings(contactId).then((d) => { pings.value = d }),
          contacts.fetchContactGroups(contactId).then((d) => { contactGroups.value = d }),
          messages.fetchThread(threadKey, { contact_id: contactId, msg_type: 'direct' }),
        ]
        if (contact.value?.contact_type_name === 'REP' || contact.value?.contact_type_name === 'SENS') {
          fetches.push(contacts.fetchTelemetry(contactId).then((d) => { telemetry.value = d }))
        }
        await Promise.all(fetches)
        await nextTick()
        renderSignalChart()
      } catch {
        toast.error('Failed to load contact')
      }
    }

    async function sendMsg(msgText) {
      if (sending.value) return
      sending.value = true
      try {
        await messages.send({
          node_id: contact.value?.node_id || nodes.activeNodeId,
          msg_type: 'direct',
          contact_id: contactId,
          text: msgText,
        })
      } catch (e) {
        toast.error(e.message || 'Failed to send')
      } finally {
        sending.value = false
      }
    }

    async function addToGroup(groupId) {
      if (!groupId) return
      try {
        await groupsStore.addMember(Number(groupId), contactId)
        contactGroups.value = await contacts.fetchContactGroups(contactId)
        selectedGroupId.value = ''
      } catch (e) {
        toast.error(e.message || 'Failed to add to group')
      }
    }

    async function createAndAddToGroup() {
      if (!newGroupName.value.trim()) return
      try {
        const group = await groupsStore.create({ name: newGroupName.value.trim() })
        await groupsStore.addMember(group.id, contactId)
        contactGroups.value = await contacts.fetchContactGroups(contactId)
        await groupsStore.fetchAll()
        newGroupName.value = ''
      } catch (e) {
        toast.error(e.message || 'Failed to create group')
      }
    }

    async function removeFromGroup(groupId) {
      try {
        await groupsStore.removeMember(groupId, contactId)
        contactGroups.value = contactGroups.value.filter((g) => g.id !== groupId)
        await groupsStore.fetchAll()
      } catch (e) {
        toast.error(e.message || 'Failed to remove from group')
      }
    }

    async function toggleFavorite() {
      try {
        contact.value = await contacts.toggleFavorite(contactId)
      } catch {
        toast.error('Failed to update favorite')
      }
    }

    async function ping() {
      if (pinging.value) return
      pinging.value = true
      pingResult.value = null
      try {
        const res = await contacts.ping(contactId)
        pingResult.value = { success: res.success, latency_ms: res.latency_ms }
        pings.value = [res, ...pings.value].slice(0, 50)
      } catch {
        pingResult.value = { success: false, latency_ms: null }
      } finally {
        pinging.value = false
      }
    }

    async function doResetPath() {
      try {
        const result = await contacts.resetPath(contactId)
        contact.value = result.contact
        toast.info('Path reset')
      } catch (e) {
        toast.error(e.message || 'Failed to reset path')
      }
    }

    async function doSetPath() {
      if (!newPath.value.trim() || settingPath.value) return
      settingPath.value = true
      try {
        const result = await contacts.setPath(contactId, newPath.value.trim())
        contact.value = result.contact
        newPath.value = ''
        toast.info('Path updated')
      } catch (e) {
        toast.error(e.message || 'Failed to set path')
      } finally {
        settingPath.value = false
      }
    }

    async function doLogin() {
      if (!adminPassword.value || adminLoggingIn.value) return
      adminLoggingIn.value = true
      try {
        await contacts.loginContact(contactId, adminPassword.value)
        loggedIn.value = true
        adminPassword.value = ''
        toast.info('Login sent to repeater')
      } catch (e) {
        toast.error(e.message || 'Login failed')
      } finally {
        adminLoggingIn.value = false
      }
    }

    async function doRequestTelemetry() {
      try {
        await contacts.requestTelemetry(contactId)
        toast.info('Telemetry requested')
      } catch (e) {
        toast.error(e.message || 'Failed to request telemetry')
      }
    }

    function renderSignalChart() {
      if (signalChart) return
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
    })

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

    onMounted(() => { load(); groupsStore.fetchAll() })
    onBeforeUnmount(() => { if (signalChart) signalChart.destroy() })

    return {
      contact, history, signal, telemetry, pings, thread,
      activeTab, sending, contactGroups, newGroupName, selectedGroupId, availableGroups,
      pinging, pingResult, adminPassword, adminLoggingIn, loggedIn, newPath, settingPath,
      isRepeater, isSensor, pathHops,
      sendMsg, addToGroup, createAndAddToGroup, removeFromGroup, toggleFavorite,
      ping, doResetPath, doSetPath, doLogin, doRequestTelemetry,
      fmtTime, avatarStyle, router, TYPE_META,
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

        <!-- Body -->
        <div class="flex flex-1 min-h-0">

          <!-- Info panel: always on desktop, mobile only when tab=info -->
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
              <div class="flex items-center gap-2 mt-3">
                <template v-if="isRepeater">
                  <button
                    @click="ping"
                    :disabled="pinging"
                    title="Ping (zero hop)"
                    class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-cyan-500 hover:text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-40"
                  ><Icon name="signal" :size="17" /></button>
                  <span
                    v-if="pingResult !== null"
                    :class="['text-xs font-mono tabular-nums', pingResult.success ? 'text-cyan-300' : 'text-rose-400']"
                  >{{ pingResult.success ? pingResult.latency_ms + 'ms' : 'timeout' }}</span>
                </template>
                <button
                  @click="toggleFavorite"
                  :class="['w-8 h-8 flex items-center justify-center rounded-lg transition-colors', contact.favorite ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-500']"
                  title="Favorite"
                ><Icon :name="contact.favorite ? 'star-solid' : 'star'" :size="17" /></button>
              </div>
            </div>

            <!-- Fields -->
            <div class="px-5 py-4 space-y-3 border-b border-white/[0.04]">
              <div class="flex justify-between text-sm">
                <span class="text-zinc-500">Last heard</span>
                <span class="text-zinc-200">{{ fmtTime(contact.last_heard) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-zinc-500">Last advert</span>
                <span class="text-zinc-200">{{ fmtTime(contact.last_advert) }}</span>
              </div>
              <div v-if="contact.lat" class="flex justify-between text-sm">
                <span class="text-zinc-500">Location</span>
                <span class="text-zinc-200 font-mono text-xs">{{ contact.lat.toFixed(4) }}, {{ contact.lon.toFixed(4) }}</span>
              </div>
              <div v-if="contact.notes" class="text-xs text-zinc-400 leading-relaxed">{{ contact.notes }}</div>
            </div>

            <!-- Path -->
            <div class="px-5 py-4 border-b border-white/[0.04]">
              <div class="flex items-center justify-between mb-2">
                <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Path</div>
                <button
                  @click="doResetPath"
                  title="Reset path"
                  class="text-zinc-700 hover:text-rose-400 transition-colors text-xs flex items-center gap-1"
                ><Icon name="refresh" :size="12" /> Reset</button>
              </div>
              <div v-if="!contact.out_path" class="text-xs text-zinc-700 mb-3">No path — direct or undiscovered</div>
              <div v-else class="space-y-1.5 mb-3">
                <div v-for="(hop, idx) in pathHops" :key="idx" class="flex items-center gap-2 text-xs">
                  <span class="text-zinc-700 w-4 flex-shrink-0 text-right font-mono">{{ idx + 1 }}</span>
                  <span class="font-mono text-[11px]" :class="hop.name ? 'text-cyan-400' : 'text-zinc-500'">{{ hop.hex }}</span>
                  <span v-if="hop.name" class="text-zinc-400 truncate">{{ hop.name }}</span>
                  <span v-else class="text-zinc-700 italic">unknown</span>
                </div>
                <div v-if="!pathHops.length" class="text-xs text-zinc-700 font-mono break-all">{{ contact.out_path }}</div>
              </div>
              <form @submit.prevent="doSetPath" class="flex gap-2">
                <input
                  v-model="newPath"
                  type="text"
                  placeholder="Set path hex…"
                  class="flex-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
                />
                <button
                  type="submit"
                  :disabled="!newPath.trim() || settingPath"
                  class="px-2.5 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-40"
                  style="background: rgba(139,92,246,0.3); border: 1px solid rgba(139,92,246,0.4);"
                >Set</button>
              </form>
            </div>

            <!-- Groups -->
            <div class="px-5 py-4 border-b border-white/[0.04]">
              <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Groups</div>
              <div class="flex flex-wrap gap-1.5 mb-3">
                <span
                  v-for="group in contactGroups"
                  :key="group.id"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border"
                  :style="{ background: group.color + '22', borderColor: group.color + '44', color: group.color }"
                >
                  {{ group.name }}
                  <button @click="removeFromGroup(group.id)" class="opacity-60 hover:opacity-100 transition-opacity">&times;</button>
                </span>
                <span v-if="!contactGroups.length" class="text-xs text-zinc-700">No groups</span>
              </div>
              <div v-if="availableGroups.length" class="flex gap-2 mb-2">
                <select
                  v-model="selectedGroupId"
                  class="flex-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-100 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
                >
                  <option value="" disabled>Add to existing group…</option>
                  <option v-for="g in availableGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
                </select>
                <button
                  @click="addToGroup(selectedGroupId)"
                  :disabled="!selectedGroupId"
                  class="px-3 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-40"
                  style="background: rgba(139,92,246,0.3); border: 1px solid rgba(139,92,246,0.4);"
                >Add</button>
              </div>
              <form @submit.prevent="createAndAddToGroup" class="flex gap-2">
                <input
                  v-model="newGroupName"
                  type="text"
                  placeholder="New group name…"
                  class="flex-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
                />
                <button
                  type="submit"
                  :disabled="!newGroupName.trim()"
                  class="px-3 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-40"
                  style="background: rgba(139,92,246,0.3); border: 1px solid rgba(139,92,246,0.4);"
                >Create</button>
              </form>
            </div>

            <!-- Repeater Admin -->
            <div v-if="isRepeater" class="px-5 py-4">
              <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-3">Repeater Admin</div>

              <!-- Not logged in -->
              <template v-if="!loggedIn">
                <form @submit.prevent="doLogin" class="space-y-2">
                  <input
                    v-model="adminPassword"
                    type="password"
                    placeholder="Admin password…"
                    class="w-full px-2.5 py-1.5 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 outline-none"
                    style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
                  />
                  <button
                    type="submit"
                    :disabled="!adminPassword || adminLoggingIn"
                    class="w-full px-3 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                    style="background: rgba(14,116,144,0.3); border: 1px solid rgba(14,116,144,0.4);"
                  >
                    <Icon name="key" :size="12" />
                    {{ adminLoggingIn ? 'Logging in…' : 'Login' }}
                  </button>
                </form>
              </template>

              <!-- Logged in: admin actions -->
              <template v-else>
                <div class="text-xs text-emerald-400 mb-3 flex items-center gap-1.5">
                  <Icon name="check-circle" :size="13" /> Logged in
                </div>
                <div class="space-y-2">
                  <button
                    @click="ping"
                    :disabled="pinging"
                    class="w-full px-3 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                    style="background: rgba(14,116,144,0.3); border: 1px solid rgba(14,116,144,0.4);"
                  ><Icon name="signal" :size="12" /> {{ pinging ? 'Pinging…' : 'Ping (zero hop)' }}</button>
                  <button
                    @click="doRequestTelemetry"
                    class="w-full px-3 py-1.5 rounded-lg text-xs text-white transition-colors flex items-center justify-center gap-1.5"
                    style="background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.3);"
                  ><Icon name="chart-bar" :size="12" /> Request Telemetry</button>
                  <button
                    @click="loggedIn = false"
                    class="w-full px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1.5"
                    style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"
                  ><Icon name="logout" :size="12" /> Logout</button>
                </div>
              </template>
            </div>
          </div>

          <!-- Activity panel: mobile tab, always on desktop -->
          <div
            :class="[
              'flex-col overflow-y-auto scrollbar-none px-4 py-4 space-y-3',
              'md:flex md:flex-none md:w-64 md:flex-shrink-0 md:border-r md:border-white/[0.05]',
              activeTab === 'activity' ? 'flex flex-1' : 'hidden'
            ]"
          >
            <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">Signal History</div>
            <div v-if="!signal.length" class="text-sm text-zinc-600 py-4 text-center">No signal data yet.</div>
            <div v-else id="signal-chart" class="rounded-xl overflow-hidden" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"></div>

            <!-- Telemetry (REP / SENS) -->
            <template v-if="isRepeater || isSensor">
              <div class="flex items-center justify-between mt-4 mb-1">
                <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Telemetry</div>
                <button
                  @click="doRequestTelemetry"
                  class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
                ><Icon name="refresh" :size="12" /> Request</button>
              </div>
              <div v-if="!telemetry.length" class="text-sm text-zinc-600 py-2 text-center">No telemetry yet.</div>
              <div
                v-for="rec in telemetry"
                :key="rec.id"
                class="rounded-xl px-3 py-2.5 space-y-1"
                style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"
              >
                <div class="text-[10px] text-zinc-600">{{ new Date(rec.timestamp).toLocaleString() }}</div>
                <div class="flex flex-wrap gap-x-4 gap-y-1">
                  <template v-for="(val, key) in rec.lpp_data" :key="key">
                    <div class="text-xs">
                      <span class="text-zinc-600 capitalize">{{ String(key).replace(/_/g, ' ') }}</span>
                      <span class="text-zinc-300 ml-1.5">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </template>

            <!-- Ping history -->
            <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mt-4 mb-1">Ping History</div>
            <div v-if="!pings.length" class="text-sm text-zinc-600 py-2 text-center">No pings recorded.</div>
            <div v-else class="space-y-1">
              <div
                v-for="p in pings"
                :key="p.id"
                class="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg"
                style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);"
              >
                <span class="text-zinc-600">{{ new Date(p.sent_at).toLocaleString() }}</span>
                <span :class="p.success ? 'text-cyan-300 font-mono' : 'text-rose-400'">
                  {{ p.success ? p.latency_ms + 'ms' : 'timeout' }}
                </span>
              </div>
            </div>

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
            <ChatPanel :thread="thread" :sending="sending" :focused="activeTab === 'chat'" @send="sendMsg" />
          </div>
        </div>
      </template>
    </div>
  `,
})
