import { defineComponent, ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContactsStore } from '../stores/contacts.js'
import { useMessagesStore } from '../stores/messages.js'
import { useNodesStore } from '../stores/nodes.js'
import { useGroupsStore } from '../stores/groups.js'
import { useToast } from '../components/shared/Toast.js'
import { getSocket } from '../socket.js'

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

function fmtUptime(s) {
  if (s === null || s === undefined) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

const TELEMETRY_FIELD_META = {
  temperature:    { label: 'Temperature',    unit: '\u00b0C',  fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v,  color: 'text-orange-300', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)' },
  temp:           { label: 'Temperature',    unit: '\u00b0C',  fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v,  color: 'text-orange-300', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)' },
  humidity:       { label: 'Humidity',       unit: '%',   fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v,  color: 'text-blue-300',   bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)' },
  pressure:       { label: 'Pressure',       unit: 'hPa', fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v,  color: 'text-zinc-300',   bg: null, border: null },
  voltage:        { label: 'Voltage',        unit: 'V',   fmt: (v) => typeof v === 'number' ? v.toFixed(2) : v,  color: 'text-emerald-300',bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
  battery_v:      { label: 'Battery',        unit: 'V',   fmt: (v) => typeof v === 'number' ? v.toFixed(2) : v,  color: 'text-emerald-300',bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
  battery:        { label: 'Battery',        unit: '%',   fmt: (v) => typeof v === 'number' ? Math.round(v) : v, color: 'text-emerald-300',bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
  altitude:       { label: 'Altitude',       unit: 'm',   fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v,  color: 'text-zinc-300',   bg: null, border: null },
  latitude:       { label: 'Latitude',       unit: '\u00b0',   fmt: (v) => typeof v === 'number' ? v.toFixed(5) : v,  color: 'text-cyan-300',   bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.2)' },
  longitude:      { label: 'Longitude',      unit: '\u00b0',   fmt: (v) => typeof v === 'number' ? v.toFixed(5) : v,  color: 'text-cyan-300',   bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.2)' },
  uptime:         { label: 'Uptime',         unit: '',    fmt: fmtUptime,                                           color: 'text-violet-300', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
  uptime_secs:    { label: 'Uptime',         unit: '',    fmt: fmtUptime,                                           color: 'text-violet-300', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
  rssi:           { label: 'RSSI',           unit: 'dBm', fmt: (v) => v,                                           color: 'text-violet-300', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
  snr:            { label: 'SNR',            unit: 'dB',  fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v,  color: 'text-violet-300', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
  tx_power:       { label: 'TX Power',       unit: 'dBm', fmt: (v) => v,                                           color: 'text-amber-300',  bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  luminosity:     { label: 'Luminosity',     unit: 'lux', fmt: (v) => v,                                           color: 'text-amber-300',  bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  power:          { label: 'Power',          unit: 'W',   fmt: (v) => typeof v === 'number' ? v.toFixed(2) : v,  color: 'text-amber-300',  bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  noise_floor:    { label: 'Noise Floor',    unit: 'dB',  fmt: (v) => v,                                           color: 'text-zinc-400',   bg: null, border: null },
}

function renderTelemetryEntry(rec) {
  if (!rec?.lpp_data) return []
  const data = typeof rec.lpp_data === 'string' ? JSON.parse(rec.lpp_data) : rec.lpp_data
  return Object.entries(data).map(([key, val]) => {
    const meta = TELEMETRY_FIELD_META[key.toLowerCase()]
    let displayVal
    if (meta) {
      displayVal = meta.fmt(val)
    } else if (typeof val === 'object' && val !== null) {
      displayVal = JSON.stringify(val)
    } else {
      displayVal = String(val)
    }
    return {
      key,
      label: meta?.label ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: displayVal,
      unit: meta?.unit ?? '',
      color: meta?.color ?? 'text-zinc-300',
      bg: meta?.bg ?? null,
      border: meta?.border ?? null,
      unknown: !meta,
    }
  })
}

function fmtStatusKey(key) {
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtStatusValue(key, val) {
  if (val === null || val === undefined) return '—'
  const k = key.toLowerCase()
  if (k === 'uptime_secs' || k === 'uptime') return fmtUptime(val)
  if (k.includes('noise')) return `${val} dB`
  if (k === 'last_rssi' || k === 'last_snr') return `${val} dB`
  if (k === 'voltage' || k.endsWith('_v')) return `${typeof val === 'number' ? val.toFixed(2) : val} V`
  if (k === 'freq') return `${val} MHz`
  if (k === 'tx_power' || k === 'txpwr') return `${val} dBm`
  return String(val)
}

const ADMIN_SETTINGS = [
  { key: 'name',  label: 'Device Name',       getCmd: 'get name',  setPrefix: 'set name',  placeholder: 'e.g. MyRepeater' },
  { key: 'txpwr', label: 'TX Power (dBm)',     getCmd: 'get txpwr', setPrefix: 'set txpwr', placeholder: 'e.g. 20' },
  { key: 'freq',  label: 'Frequency (MHz)',    getCmd: 'get freq',  setPrefix: 'set freq',  placeholder: 'e.g. 915.0' },
  { key: 'bw',    label: 'Bandwidth (kHz)',    getCmd: 'get bw',    setPrefix: 'set bw',    placeholder: 'e.g. 250' },
  { key: 'sf',    label: 'Spreading Factor',   getCmd: 'get sf',    setPrefix: 'set sf',    placeholder: 'e.g. 10' },
  { key: 'cr',    label: 'Coding Rate',        getCmd: 'get cr',    setPrefix: 'set cr',    placeholder: 'e.g. 5' },
]

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
    const activeTab = ref('chat')
    const sending = ref(false)
    const contactGroups = ref([])
    const groupSearch = ref('')
    const groupSearchOpen = ref(false)
    const pinging = ref(false)
    const pingResult = ref(null)
    const pings = ref([])
    const newPath = ref('')
    const settingPath = ref(false)
    let signalChart = null

    const currentPage = ref(null) // null | 'activity' | 'admin'

    const telemetryModal = ref(false)
    const telemetryPassword = ref('')
    const requestingTelemetry = ref(false)
    let telemetryTimeout = null

    const adminPassword = ref('')
    const adminLoggingIn = ref(false)
    const loggedIn = ref(false)
    const adminStatus = ref(null)
    const fetchingAdminStatus = ref(false)
    const adminAcl = ref(null)
    const fetchingAdminAcl = ref(false)
    const cliInput = ref('')
    const cliSending = ref(false)
    const cliHistory = ref([])
    const settingInputs = ref({})

    const thread = computed(() => messages.threads[threadKey] || [])
    const isRepeater = computed(() => contact.value?.contact_type_name === 'REP')
    const isSensor = computed(() => contact.value?.contact_type_name === 'SENS')
    const hasTelemetry = computed(() => isRepeater.value || isSensor.value)
    const availableGroups = computed(() =>
      groupsStore.groups.filter((g) => !contactGroups.value.find((cg) => cg.id === g.id))
    )
    const filteredAvailableGroups = computed(() => {
      const q = groupSearch.value.toLowerCase().trim()
      return q ? availableGroups.value.filter((g) => g.name.toLowerCase().includes(q)) : availableGroups.value
    })

    const pathHops = computed(() => {
      const raw = contact.value?.out_path
      if (!raw) return []
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
        if (contact.value?.contact_type_name === 'REP') activeTab.value = 'info'
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
      } catch {
        toast.error('Failed to load contact')
      }
    }

    function handleTelemetryReceived(data) {
      if (data.contact_id !== contactId) return
      if (requestingTelemetry.value) {
        if (telemetryTimeout) { clearTimeout(telemetryTimeout); telemetryTimeout = null }
        requestingTelemetry.value = false
      }
      telemetry.value = [data.record, ...telemetry.value].slice(0, 50)
    }

    function handleMessageReceived(data) {
      const msg = data.message
      if (msg.contact_id !== contactId || msg.direction !== 'in') return
      if (isRepeater.value) {
        cliHistory.value.push({ type: 'received', text: msg.text, ts: Date.now() })
      }
    }

    function handleAdminStatus(data) {
      if (data.contact_id !== contactId) return
      adminStatus.value = data.status
      fetchingAdminStatus.value = false
    }

    function handleAdminAcl(data) {
      if (data.contact_id !== null && data.contact_id !== contactId) return
      adminAcl.value = data.data
      fetchingAdminAcl.value = false
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
        groupSearch.value = ''
        groupSearchOpen.value = false
      } catch (e) {
        toast.error(e.message || 'Failed to add to group')
      }
    }

    async function createAndAddToGroup() {
      if (!groupSearch.value.trim()) return
      try {
        const group = await groupsStore.create({ name: groupSearch.value.trim() })
        await groupsStore.addMember(group.id, contactId)
        contactGroups.value = await contacts.fetchContactGroups(contactId)
        await groupsStore.fetchAll()
        groupSearch.value = ''
        groupSearchOpen.value = false
      } catch (e) {
        toast.error(e.message || 'Failed to create group')
      }
    }

    function blurGroupSearch() {
      setTimeout(() => { groupSearchOpen.value = false }, 150)
    }

    function closeGroupSearch() {
      groupSearch.value = ''
      groupSearchOpen.value = false
    }

    function selectFirstGroupOption() {
      if (filteredAvailableGroups.value.length) {
        addToGroup(filteredAvailableGroups.value[0].id)
      } else if (groupSearch.value.trim()) {
        createAndAddToGroup()
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
      const pwd = adminPassword.value
      adminPassword.value = ''
      try {
        await contacts.loginContact(contactId, pwd)
        loggedIn.value = true
        toast.info('Admin access granted')
      } catch (e) {
        loggedIn.value = false
        toast.error(e.message || 'Login rejected')
      } finally {
        adminLoggingIn.value = false
      }
    }

    function handleLoginSuccess(data) {
      if (data.contact_id !== contactId) return
      loggedIn.value = true
    }

    function handleLoginFailed(data) {
      if (data.contact_id !== contactId) return
      loggedIn.value = false
      adminLoggingIn.value = false
    }

    async function doLogout() {
      try { await contacts.logoutContact(contactId) } catch { /* reset client side */ }
      loggedIn.value = false
      adminStatus.value = null
      adminAcl.value = null
      cliHistory.value = []
    }

    async function openTelemetryModal() {
      telemetryPassword.value = ''
      telemetryModal.value = true
    }

    async function submitTelemetryRequest() {
      if (requestingTelemetry.value) return
      requestingTelemetry.value = true
      telemetryModal.value = false
      try {
        await contacts.requestTelemetry(contactId, telemetryPassword.value)
        telemetryTimeout = setTimeout(() => {
          if (requestingTelemetry.value) {
            requestingTelemetry.value = false
            toast.error('Telemetry request timed out after 30s')
          }
        }, 30000)
      } catch (e) {
        requestingTelemetry.value = false
        toast.error(e.message || 'Failed to request telemetry')
      }
    }

    async function doRequestAdminStatus() {
      if (fetchingAdminStatus.value) return
      fetchingAdminStatus.value = true
      adminStatus.value = null
      try {
        await contacts.requestAdminStatus(contactId)
      } catch (e) {
        fetchingAdminStatus.value = false
        toast.error(e.message || 'Failed to request status')
      }
    }

    async function doRequestAdminAcl() {
      if (fetchingAdminAcl.value) return
      fetchingAdminAcl.value = true
      adminAcl.value = null
      try {
        await contacts.requestAdminAcl(contactId)
      } catch (e) {
        fetchingAdminAcl.value = false
        toast.error(e.message || 'Failed to request ACL')
      }
    }

    async function sendCliCmd(cmd) {
      const text = (typeof cmd === 'string' ? cmd : cliInput.value).trim()
      if (!text || cliSending.value) return
      cliHistory.value.push({ type: 'sent', text, ts: Date.now() })
      if (typeof cmd !== 'string') cliInput.value = ''
      cliSending.value = true
      try {
        await contacts.sendAdminCmd(contactId, text)
      } catch (e) {
        toast.error(e.message || 'Failed to send command')
      } finally {
        cliSending.value = false
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

    watch(currentPage, (newPage, oldPage) => {
      if (oldPage === 'activity' && signalChart) {
        signalChart.destroy()
        signalChart = null
      }
      if (newPage === 'activity') nextTick(renderSignalChart)
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

    onMounted(() => {
      load()
      groupsStore.fetchAll()
      const socket = getSocket()
      if (socket) {
        socket.on('telemetry:received', handleTelemetryReceived)
        socket.on('message:received', handleMessageReceived)
        socket.on('node:status', handleAdminStatus)
        socket.on('admin:acl', handleAdminAcl)
        socket.on('admin:login_success', handleLoginSuccess)
        socket.on('admin:login_failed', handleLoginFailed)
      }
    })

    onBeforeUnmount(() => {
      if (signalChart) signalChart.destroy()
      if (telemetryTimeout) clearTimeout(telemetryTimeout)
      const socket = getSocket()
      if (socket) {
        socket.off('telemetry:received', handleTelemetryReceived)
        socket.off('message:received', handleMessageReceived)
        socket.off('node:status', handleAdminStatus)
        socket.off('admin:acl', handleAdminAcl)
        socket.off('admin:login_success', handleLoginSuccess)
        socket.off('admin:login_failed', handleLoginFailed)
      }
    })

    return {
      contact, history, signal, telemetry, pings, thread,
      activeTab, sending, contactGroups, groupSearch, groupSearchOpen, availableGroups, filteredAvailableGroups,
      pinging, pingResult, newPath, settingPath,
      isRepeater, isSensor, hasTelemetry, pathHops,
      currentPage, telemetryModal, telemetryPassword, requestingTelemetry,
      adminPassword, adminLoggingIn, loggedIn,
      adminStatus, fetchingAdminStatus, adminAcl, fetchingAdminAcl,
      cliInput, cliSending, cliHistory, settingInputs,
      sendMsg, addToGroup, createAndAddToGroup, removeFromGroup, toggleFavorite,
      blurGroupSearch, closeGroupSearch, selectFirstGroupOption,
      ping, doResetPath, doSetPath, doLogin, doLogout,
      openTelemetryModal, submitTelemetryRequest,
      doRequestAdminStatus, doRequestAdminAcl, sendCliCmd,
      fmtTime, fmtUptime, fmtStatusKey, fmtStatusValue,
      renderTelemetryEntry, avatarStyle, router, TYPE_META, ADMIN_SETTINGS,
    }
  },

  template: `
    <div class="h-full flex flex-col">
      <div v-if="!contact" class="flex items-center justify-center h-full"><Spinner /></div>

      <template v-else>
        <div
          class="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]"
          style="background: rgba(9,9,15,0.7); backdrop-filter: blur(16px);"
        >
          <button
            @click="currentPage ? currentPage = null : router.push('/contacts')"
            class="text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0"
          ><Icon name="chevron-left" :size="22" /></button>

          <template v-if="currentPage === 'activity'">
            <div class="flex-1 text-sm font-semibold text-white">Activity</div>
          </template>

          <template v-else-if="currentPage === 'admin'">
            <!-- Mobile: "Repeater Admin" title; Desktop: show normal contact header (admin is always right panel) -->
            <div class="md:hidden flex-1">
              <div class="text-sm font-semibold text-white">Repeater Admin</div>
              <div v-if="loggedIn" class="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                <Icon name="check-circle" :size="10" /> Authenticated
              </div>
            </div>
            <div class="hidden md:flex flex-1 items-center gap-3">
              <div
                class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                :style="{ background: avatarStyle(contact) }"
              >{{ (contact.adv_name || contact.short_name || '?')[0].toUpperCase() }}</div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-white truncate">{{ contact.adv_name || contact.short_name || 'Unknown' }}</div>
                <span :class="['text-[10px] font-medium px-1.5 py-0.5 rounded-md border', TYPE_META[contact.contact_type_name]?.cls || TYPE_META.NONE.cls]">
                  {{ TYPE_META[contact.contact_type_name]?.label || contact.contact_type_name }}
                </span>
              </div>
            </div>
          </template>

          <template v-else>
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
              :style="{ background: avatarStyle(contact) }"
            >{{ (contact.adv_name || contact.short_name || '?')[0].toUpperCase() }}</div>

            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-white truncate">{{ contact.adv_name || contact.short_name || 'Unknown' }}</div>
              <span :class="['text-[10px] font-medium px-1.5 py-0.5 rounded-md border', TYPE_META[contact.contact_type_name]?.cls || TYPE_META.NONE.cls]">
                {{ TYPE_META[contact.contact_type_name]?.label || contact.contact_type_name }}
              </span>
            </div>

            <div
              v-if="!isRepeater"
              class="flex gap-1 md:hidden"
              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 3px;"
            >
              <button
                v-for="t in ['chat','info']"
                :key="t"
                @click="activeTab = t"
                :class="['px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-all', activeTab === t ? 'bg-violet-600 text-white' : 'text-zinc-500']"
              >{{ t }}</button>
            </div>
          </template>
        </div>

        <!-- ACTIVITY PAGE -->
        <div v-if="currentPage === 'activity'" class="flex-1 overflow-y-auto scrollbar-none px-4 py-5 space-y-6">
          <div>
            <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Signal History</div>
            <div v-if="!signal.length" class="text-sm text-zinc-600 py-4 text-center">No signal data yet.</div>
            <div v-else id="signal-chart" class="rounded-xl overflow-hidden" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"></div>
          </div>

          <template v-if="hasTelemetry">
            <div>
              <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-3">Telemetry History</div>
              <div v-if="!telemetry.length" class="text-sm text-zinc-600 py-2 text-center">No telemetry recorded.</div>
              <div v-else class="space-y-3">
                <div
                  v-for="rec in telemetry"
                  :key="rec.id"
                  class="rounded-xl px-4 py-3"
                  style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"
                >
                  <div class="text-[10px] text-zinc-600 mb-2">{{ new Date(rec.timestamp).toLocaleString() }}</div>
                  <div class="grid grid-cols-2 gap-2">
                    <div
                      v-for="field in renderTelemetryEntry(rec)"
                      :key="field.key"
                      class="rounded-lg px-2.5 py-2"
                      :style="{ background: field.bg || 'rgba(255,255,255,0.03)', border: '1px solid ' + (field.border || 'rgba(255,255,255,0.06)') }"
                    >
                      <div class="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                        {{ field.label }}<span v-if="field.unknown" class="text-[9px] text-zinc-700">(unknown)</span>
                      </div>
                      <div class="font-mono font-semibold text-sm leading-none" :class="field.color">
                        {{ field.value }}<span v-if="field.unit" class="text-[11px] font-normal text-zinc-500 ml-0.5">{{ field.unit }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div>
            <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Ping History</div>
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
          </div>

          <div>
            <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Change History</div>
            <div v-if="!history.length" class="text-sm text-zinc-600 py-4 text-center">No changes recorded.</div>
            <div v-else class="space-y-1">
              <div
                v-for="entry in history"
                :key="entry.id"
                class="flex items-start gap-3 text-xs py-2 border-b border-white/[0.04]"
              >
                <span class="text-zinc-700 flex-shrink-0 w-28">{{ new Date(entry.timestamp).toLocaleString() }}</span>
                <span class="text-zinc-500">{{ entry.field_name }}</span>
                <span class="text-rose-400 line-through">{{ entry.old_value || '\u2014' }}</span>
                <span class="text-emerald-400">{{ entry.new_value || '\u2014' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ADMIN PAGE — content moved to right panel in MAIN LAYOUT below -->
        <div v-else-if="false && currentPage === 'admin'" class="flex-1 overflow-y-auto scrollbar-none px-4 py-5 space-y-5">
          <template v-if="!loggedIn">
            <div class="rounded-2xl p-5" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);">
              <div class="text-sm font-semibold text-zinc-100 mb-1">Admin Login</div>
              <div class="text-xs text-zinc-500 mb-4">Authenticate with the repeater to access admin functions.</div>
              <form @submit.prevent="doLogin" class="space-y-3">
                <input
                  v-model="adminPassword"
                  type="password"
                  placeholder="Admin password\u2026"
                  class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
                  autofocus
                />
                <button
                  type="submit"
                  :disabled="!adminPassword || adminLoggingIn"
                  class="w-full px-3 py-2.5 rounded-xl text-sm text-white font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
                >
                  <Icon name="key" :size="15" />
                  {{ adminLoggingIn ? 'Logging in\u2026' : 'Login' }}
                </button>
              </form>
            </div>
          </template>

          <template v-else>
            <div class="flex items-center justify-between">
              <div class="text-xs text-emerald-400 flex items-center gap-1.5">
                <Icon name="check-circle" :size="13" /> Authenticated as admin
              </div>
              <button
                @click="doLogout"
                class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1"
              ><Icon name="logout" :size="12" /> Logout</button>
            </div>

            <!-- Node Status -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Node Status</div>
                <button
                  @click="doRequestAdminStatus"
                  :disabled="fetchingAdminStatus"
                  class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1 disabled:opacity-40"
                ><Icon name="refresh" :size="12" /> {{ fetchingAdminStatus ? 'Waiting\u2026' : 'Fetch' }}</button>
              </div>
              <div class="rounded-xl px-4 py-3 min-h-[56px] flex items-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                <div v-if="fetchingAdminStatus" class="flex items-center gap-2 text-xs text-zinc-600">
                  <Spinner /> Waiting for response\u2026
                </div>
                <div v-else-if="!adminStatus" class="text-xs text-zinc-700">
                  Click Fetch to request status from the node.
                </div>
                <div v-else class="w-full grid grid-cols-2 gap-x-4 gap-y-2">
                  <div v-for="(val, key) in adminStatus" :key="key">
                    <div class="text-[10px] text-zinc-600 uppercase tracking-wider">{{ fmtStatusKey(key) }}</div>
                    <div class="text-sm font-mono text-zinc-200 mt-0.5">{{ fmtStatusValue(key, val) }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- CLI -->
            <div>
              <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Command Line</div>
              <div class="rounded-xl overflow-hidden" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.07);">
                <div class="h-52 overflow-y-auto scrollbar-none p-3 space-y-0.5 font-mono text-xs">
                  <div v-if="!cliHistory.length" class="text-zinc-700 py-4 text-center">No commands sent yet.</div>
                  <div
                    v-for="(entry, i) in cliHistory"
                    :key="i"
                    class="leading-5"
                    :class="entry.type === 'sent' ? 'text-violet-300' : 'text-zinc-300'"
                  >
                    <span class="text-zinc-700 select-none mr-1">{{ entry.type === 'sent' ? '>' : '<' }}</span>{{ entry.text }}
                  </div>
                </div>
                <div class="flex items-center gap-2 px-3 py-2.5 border-t border-white/[0.06]">
                  <span class="text-zinc-600 font-mono text-xs select-none">$</span>
                  <input
                    v-model="cliInput"
                    @keydown.enter.prevent="sendCliCmd()"
                    type="text"
                    placeholder="Enter command\u2026"
                    class="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-700 outline-none font-mono"
                  />
                  <button
                    @click="sendCliCmd()"
                    :disabled="!cliInput.trim() || cliSending"
                    class="text-zinc-600 hover:text-violet-400 transition-colors disabled:opacity-40"
                  ><Icon name="send" :size="15" /></button>
                </div>
              </div>
            </div>

            <!-- Settings -->
            <div>
              <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-3">Settings</div>
              <div class="space-y-2">
                <div
                  v-for="s in ADMIN_SETTINGS"
                  :key="s.key"
                  class="rounded-xl px-3 py-3"
                  style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs text-zinc-400 font-medium">{{ s.label }}</span>
                    <button
                      @click="sendCliCmd(s.getCmd)"
                      class="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1"
                    ><Icon name="refresh" :size="10" /> Fetch</button>
                  </div>
                  <div class="flex gap-2">
                    <input
                      :value="settingInputs[s.key] || ''"
                      @input="settingInputs[s.key] = $event.target.value"
                      type="text"
                      :placeholder="s.placeholder"
                      class="flex-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-100 placeholder-zinc-700 outline-none font-mono"
                      style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
                      @keydown.enter.prevent="settingInputs[s.key] && sendCliCmd(s.setPrefix + ' ' + settingInputs[s.key])"
                    />
                    <button
                      @click="settingInputs[s.key] && sendCliCmd(s.setPrefix + ' ' + settingInputs[s.key])"
                      :disabled="!settingInputs[s.key]"
                      class="px-2.5 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-40"
                      style="background: rgba(139,92,246,0.3); border: 1px solid rgba(139,92,246,0.4);"
                    >Set</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- ACL -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Access Control List</div>
                <button
                  @click="doRequestAdminAcl"
                  :disabled="fetchingAdminAcl"
                  class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1 disabled:opacity-40"
                ><Icon name="refresh" :size="12" /> {{ fetchingAdminAcl ? 'Waiting\u2026' : 'Fetch' }}</button>
              </div>
              <div class="rounded-xl px-4 py-3 min-h-[48px] flex items-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                <div v-if="fetchingAdminAcl" class="flex items-center gap-2 text-xs text-zinc-600">
                  <Spinner /> Waiting\u2026
                </div>
                <div v-else-if="!adminAcl" class="text-xs text-zinc-700">Click Fetch to request the ACL from the node.</div>
                <pre v-else class="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all w-full">{{ JSON.stringify(adminAcl, null, 2) }}</pre>
              </div>
            </div>
          </template>
        </div>

        <!-- MAIN LAYOUT -->
        <div v-else class="flex flex-1 min-h-0">

          <!-- Info Panel -->
          <div
            :class="[
              'flex-col border-r border-white/[0.05] overflow-y-auto scrollbar-none',
              (isRepeater ? currentPage !== 'admin' : activeTab === 'info') ? 'flex flex-1 md:flex-initial md:w-72 md:flex-shrink-0' : 'hidden md:flex md:flex-initial md:w-72 md:flex-shrink-0'
            ]"
            style="background: rgba(9,9,15,0.4);"
          >
            <div class="p-5 border-b border-white/[0.05]">
              <div
                class="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl mb-3 shadow-lg"
                :style="{ background: avatarStyle(contact) }"
              >{{ (contact.adv_name || '?')[0].toUpperCase() }}</div>
              <div class="text-base font-bold text-white">{{ contact.adv_name || 'Unknown' }}</div>
              <div v-if="contact.short_name" class="text-xs text-zinc-500 mt-0.5">{{ contact.short_name }}</div>
              <div class="text-[10px] text-zinc-700 font-mono mt-1 break-all">{{ contact.public_key }}</div>

              <div class="flex items-center gap-1.5 mt-3 flex-wrap">
                <button
                  @click="ping"
                  :disabled="pinging"
                  class="h-8 px-2.5 flex items-center gap-1.5 rounded-lg transition-colors text-cyan-500 hover:text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-40 text-xs font-medium"
                >
                  <Icon name="signal" :size="14" />{{ pinging ? '\u2026' : 'Ping' }}
                </button>
                <span
                  v-if="pingResult !== null"
                  :class="['text-xs font-mono tabular-nums', pingResult.success ? 'text-cyan-300' : 'text-rose-400']"
                >{{ pingResult.success ? pingResult.latency_ms + 'ms' : 'timeout' }}</span>

                <button
                  v-if="hasTelemetry"
                  @click="openTelemetryModal"
                  :disabled="requestingTelemetry"
                  class="h-8 px-2.5 flex items-center gap-1.5 rounded-lg transition-colors text-emerald-500 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40 text-xs font-medium"
                >
                  <Spinner v-if="requestingTelemetry" />
                  <Icon v-else name="chart-bar" :size="14" />
                  {{ requestingTelemetry ? 'Waiting\u2026' : 'Telemetry' }}
                </button>

                <button
                  @click="toggleFavorite"
                  :class="['ml-auto w-8 h-8 flex items-center justify-center rounded-lg transition-colors', contact.favorite ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-500']"
                  title="Favorite"
                ><Icon :name="contact.favorite ? 'star-solid' : 'star'" :size="17" /></button>
              </div>
            </div>

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

            <!-- Latest telemetry -->
            <div v-if="hasTelemetry && telemetry.length" class="px-5 py-4 border-b border-white/[0.04]">
              <div class="flex items-center justify-between mb-2">
                <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Latest Telemetry</div>
                <div class="text-[10px] text-zinc-700">{{ new Date(telemetry[0].timestamp).toLocaleString() }}</div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="field in renderTelemetryEntry(telemetry[0])"
                  :key="field.key"
                  class="rounded-lg px-2.5 py-2"
                  :style="{ background: field.bg || 'rgba(255,255,255,0.03)', border: '1px solid ' + (field.border || 'rgba(255,255,255,0.06)') }"
                >
                  <div class="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                    {{ field.label }}<span v-if="field.unknown" class="text-[9px] text-zinc-700">(unknown)</span>
                  </div>
                  <div class="font-mono font-semibold text-sm leading-none" :class="field.color">
                    {{ field.value }}<span v-if="field.unit" class="text-[11px] font-normal text-zinc-500 ml-0.5">{{ field.unit }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Path -->
            <div class="px-5 py-4 border-b border-white/[0.04]">
              <div class="flex items-center justify-between mb-2">
                <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Path</div>
                <button
                  @click="doResetPath"
                  class="text-zinc-700 hover:text-rose-400 transition-colors text-xs flex items-center gap-1"
                ><Icon name="refresh" :size="12" /> Reset</button>
              </div>
              <div v-if="!contact.out_path" class="text-xs text-zinc-700 mb-3">No path \u2014 direct or undiscovered</div>
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
                  placeholder="Set path hex\u2026"
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
                  :style="{ background: (group.color || '#7c3aed') + '22', borderColor: (group.color || '#7c3aed') + '44', color: group.color || '#a78bfa' }"
                >
                  {{ group.name }}
                  <button @click="removeFromGroup(group.id)" class="opacity-50 hover:opacity-100 transition-opacity leading-none">&times;</button>
                </span>
                <span v-if="!contactGroups.length" class="text-xs text-zinc-700">No groups</span>
              </div>
              <div class="relative">
                <div
                  class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
                >
                  <Icon name="plus" :size="13" class="text-zinc-600 flex-shrink-0" />
                  <input
                    v-model="groupSearch"
                    @focus="groupSearchOpen = true"
                    @blur="blurGroupSearch"
                    @keydown.enter.prevent="selectFirstGroupOption"
                    @keydown.escape="closeGroupSearch"
                    type="text"
                    placeholder="Add or create group\u2026"
                    class="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none"
                  />
                </div>
                <div
                  v-if="groupSearchOpen && (filteredAvailableGroups.length || groupSearch.trim())"
                  class="absolute z-20 left-0 right-0 mt-1 rounded-xl overflow-hidden py-1"
                  style="background: rgba(13,13,22,0.98); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 24px rgba(0,0,0,0.5);"
                >
                  <button
                    v-for="g in filteredAvailableGroups"
                    :key="g.id"
                    @mousedown.prevent="addToGroup(g.id)"
                    class="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.06] transition-colors flex items-center gap-2.5"
                  >
                    <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: g.color || '#7c3aed' }"></span>
                    {{ g.name }}
                  </button>
                  <button
                    v-if="groupSearch.trim() && !filteredAvailableGroups.find(g => g.name.toLowerCase() === groupSearch.trim().toLowerCase())"
                    @mousedown.prevent="createAndAddToGroup"
                    class="w-full text-left px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/10 transition-colors flex items-center gap-2"
                  >
                    <Icon name="plus-circle" :size="13" />
                    Create \u201c{{ groupSearch.trim() }}\u201d
                  </button>
                  <div
                    v-if="!filteredAvailableGroups.length && !groupSearch.trim()"
                    class="px-3 py-2 text-xs text-zinc-600 text-center"
                  >All groups added</div>
                </div>
              </div>
            </div>

            <!-- Nav buttons -->
            <div class="px-5 py-2">
              <button
                @click="currentPage = 'activity'"
                class="w-full flex items-center justify-between py-3 text-sm text-zinc-400 hover:text-zinc-200 transition-colors border-b border-white/[0.04]"
              >
                <div class="flex items-center gap-2.5"><Icon name="chart-bar" :size="16" /> Activity</div>
                <Icon name="chevron-right" :size="16" />
              </button>
              <button
                v-if="isRepeater"
                @click="currentPage = 'admin'"
                class="md:hidden w-full flex items-center justify-between py-3 text-sm text-cyan-400 hover:text-cyan-200 transition-colors"
              >
                <div class="flex items-center gap-2.5"><Icon name="cog" :size="16" /> Repeater Admin</div>
                <Icon name="chevron-right" :size="16" />
              </button>
            </div>
          </div>

          <!-- Chat Panel (non-repeaters only) -->
          <div
            v-if="!isRepeater"
            :class="[
              'flex-col flex-1 min-w-0',
              activeTab === 'chat' ? 'flex' : 'hidden',
              'md:flex'
            ]"
          >
            <ChatPanel :thread="thread" :sending="sending" :focused="activeTab === 'chat'" @send="sendMsg" />
          </div>

          <!-- Admin Panel (repeaters only): Mobile = full page when currentPage==='admin'; Desktop = always visible right panel -->
          <div
            v-if="isRepeater"
            :class="currentPage === 'admin' ? 'flex flex-1 flex-col min-w-0' : 'hidden md:flex md:flex-1 md:flex-col md:min-w-0'"
            style="background: rgba(9,9,15,0.4); border-left: 1px solid rgba(255,255,255,0.05);"
          >
            <!-- Desktop panel header -->
            <div class="hidden md:flex flex-shrink-0 items-center justify-between px-4 py-3 border-b border-white/[0.05]">
              <span class="text-sm font-semibold text-white">Repeater Admin</span>
              <div class="flex items-center gap-3">
                <div v-if="loggedIn" class="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Icon name="check-circle" :size="11" /> Authenticated
                </div>
                <button v-if="loggedIn" @click="doLogout" class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1">
                  <Icon name="logout" :size="12" /> Logout
                </button>
              </div>
            </div>

            <!-- NOT LOGGED IN: centered login form -->
            <div v-if="!loggedIn" class="flex flex-1 items-center justify-center p-6">
              <div class="w-full max-w-xs space-y-5">
                <div class="text-center">
                  <div
                    class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style="background: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.25);"
                  >
                    <Icon name="key" :size="22" class="text-violet-400" />
                  </div>
                  <div class="text-sm font-semibold text-zinc-100 mb-1">Admin Login</div>
                  <div class="text-xs text-zinc-500 leading-relaxed">Authenticate to manage this repeater remotely.</div>
                </div>
                <form @submit.prevent="doLogin" class="space-y-3">
                  <input
                    v-model="adminPassword"
                    type="password"
                    placeholder="Admin password\u2026"
                    autocomplete="new-password"
                    class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                    style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
                  />
                  <button
                    type="submit"
                    :disabled="!adminPassword || adminLoggingIn"
                    class="w-full px-3 py-2.5 rounded-xl text-sm text-white font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                    style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
                  >
                    <Spinner v-if="adminLoggingIn" />
                    <Icon v-else name="key" :size="15" />
                    {{ adminLoggingIn ? 'Waiting for response\u2026' : 'Login' }}
                  </button>
                </form>
              </div>
            </div>

            <!-- LOGGED IN: admin content -->
            <div v-else class="flex-1 overflow-y-auto scrollbar-none px-4 py-5 space-y-5">
              <!-- Mobile auth bar (desktop shows in panel header) -->
              <div class="flex md:hidden items-center justify-between">
                <div class="text-xs text-emerald-400 flex items-center gap-1.5">
                  <Icon name="check-circle" :size="13" /> Authenticated as admin
                </div>
                <button @click="doLogout" class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1">
                  <Icon name="logout" :size="12" /> Logout
                </button>
              </div>

              <!-- Quick Actions -->
              <div class="flex flex-wrap gap-2">
                <button
                  @click="doRequestAdminStatus"
                  :disabled="fetchingAdminStatus"
                  class="h-8 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                >
                  <Spinner v-if="fetchingAdminStatus" /><Icon v-else name="cpu-chip" :size="13" />
                  {{ fetchingAdminStatus ? 'Fetching\u2026' : 'Request Status' }}
                </button>
                <button
                  @click="doRequestAdminAcl"
                  :disabled="fetchingAdminAcl"
                  class="h-8 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                >
                  <Spinner v-if="fetchingAdminAcl" /><Icon v-else name="key" :size="13" />
                  {{ fetchingAdminAcl ? 'Fetching\u2026' : 'Request ACL' }}
                </button>
                <button
                  @click="sendCliCmd('advert')"
                  class="h-8 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                >
                  <Icon name="wifi" :size="13" /> Send Advert
                </button>
                <button
                  @click="sendCliCmd('reboot')"
                  class="h-8 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                >
                  <Icon name="refresh" :size="13" /> Reboot
                </button>
              </div>

              <!-- Node Status -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Node Status</div>
                  <button
                    @click="doRequestAdminStatus"
                    :disabled="fetchingAdminStatus"
                    class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1 disabled:opacity-40"
                  ><Icon name="refresh" :size="12" /> {{ fetchingAdminStatus ? 'Waiting\u2026' : 'Fetch' }}</button>
                </div>
                <div class="rounded-xl px-4 py-3 min-h-[56px] flex items-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                  <div v-if="fetchingAdminStatus" class="flex items-center gap-2 text-xs text-zinc-600">
                    <Spinner /> Waiting for response\u2026
                  </div>
                  <div v-else-if="!adminStatus" class="text-xs text-zinc-700">
                    Click Fetch to request status from the node.
                  </div>
                  <div v-else class="w-full grid grid-cols-2 gap-x-4 gap-y-2">
                    <div v-for="(val, key) in adminStatus" :key="key">
                      <div class="text-[10px] text-zinc-600 uppercase tracking-wider">{{ fmtStatusKey(key) }}</div>
                      <div class="text-sm font-mono text-zinc-200 mt-0.5">{{ fmtStatusValue(key, val) }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- CLI -->
              <div>
                <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Command Line</div>
                <div class="rounded-xl overflow-hidden" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.07);">
                  <div class="h-52 overflow-y-auto scrollbar-none p-3 space-y-0.5 font-mono text-xs">
                    <div v-if="!cliHistory.length" class="text-zinc-700 py-4 text-center">No commands sent yet.</div>
                    <div
                      v-for="(entry, i) in cliHistory"
                      :key="i"
                      class="leading-5"
                      :class="entry.type === 'sent' ? 'text-violet-300' : 'text-zinc-300'"
                    >
                      <span class="text-zinc-700 select-none mr-1">{{ entry.type === 'sent' ? '>' : '<' }}</span>{{ entry.text }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 px-3 py-2.5 border-t border-white/[0.06]">
                    <span class="text-zinc-600 font-mono text-xs select-none">$</span>
                    <input
                      v-model="cliInput"
                      @keydown.enter.prevent="sendCliCmd()"
                      type="text"
                      placeholder="Enter command\u2026"
                      class="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-700 outline-none font-mono"
                    />
                    <button
                      @click="sendCliCmd()"
                      :disabled="!cliInput.trim() || cliSending"
                      class="text-zinc-600 hover:text-violet-400 transition-colors disabled:opacity-40"
                    ><Icon name="send" :size="15" /></button>
                  </div>
                </div>
              </div>

              <!-- Settings -->
              <div>
                <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-3">Settings</div>
                <div class="space-y-2">
                  <div
                    v-for="s in ADMIN_SETTINGS"
                    :key="s.key"
                    class="rounded-xl px-3 py-3"
                    style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs text-zinc-400 font-medium">{{ s.label }}</span>
                      <button
                        @click="sendCliCmd(s.getCmd)"
                        class="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1"
                      ><Icon name="refresh" :size="10" /> Fetch</button>
                    </div>
                    <div class="flex gap-2">
                      <input
                        :value="settingInputs[s.key] || ''"
                        @input="settingInputs[s.key] = $event.target.value"
                        type="text"
                        :placeholder="s.placeholder"
                        class="flex-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-100 placeholder-zinc-700 outline-none font-mono"
                        style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
                        @keydown.enter.prevent="settingInputs[s.key] && sendCliCmd(s.setPrefix + ' ' + settingInputs[s.key])"
                      />
                      <button
                        @click="settingInputs[s.key] && sendCliCmd(s.setPrefix + ' ' + settingInputs[s.key])"
                        :disabled="!settingInputs[s.key]"
                        class="px-2.5 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-40"
                        style="background: rgba(139,92,246,0.3); border: 1px solid rgba(139,92,246,0.4);"
                      >Set</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ACL -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Access Control List</div>
                  <button
                    @click="doRequestAdminAcl"
                    :disabled="fetchingAdminAcl"
                    class="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1 disabled:opacity-40"
                  ><Icon name="refresh" :size="12" /> {{ fetchingAdminAcl ? 'Waiting\u2026' : 'Fetch' }}</button>
                </div>
                <div class="rounded-xl px-4 py-3 min-h-[48px] flex items-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                  <div v-if="fetchingAdminAcl" class="flex items-center gap-2 text-xs text-zinc-600">
                    <Spinner /> Waiting\u2026
                  </div>
                  <div v-else-if="!adminAcl" class="text-xs text-zinc-700">Click Fetch to request the ACL from the node.</div>
                  <pre v-else class="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all w-full">{{ JSON.stringify(adminAcl, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Telemetry Modal -->
      <div
        v-if="telemetryModal"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
        @click.self="telemetryModal = false"
      >
        <div
          class="w-full max-w-sm rounded-2xl p-5 space-y-4"
          style="background: rgba(15,15,24,0.97); border: 1px solid rgba(255,255,255,0.1);"
        >
          <div>
            <div class="text-base font-semibold text-white mb-1">Request Telemetry</div>
            <div class="text-xs text-zinc-500">Some nodes require a password to return telemetry. Leave blank if not required.</div>
          </div>
          <input
            v-model="telemetryPassword"
            type="password"
            placeholder="Password (optional)"
            class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
            @keydown.enter.prevent="submitTelemetryRequest"
          />
          <div class="flex gap-2">
            <button
              @click="telemetryModal = false"
              class="flex-1 px-3 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);"
            >Cancel</button>
            <button
              @click="submitTelemetryRequest"
              class="flex-1 px-3 py-2.5 rounded-xl text-sm text-white font-semibold"
              style="background: linear-gradient(135deg, #059669, #047857);"
            >Request</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
