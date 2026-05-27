import { defineComponent, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useNodesStore } from '../stores/nodes.js'
import { useToast } from '../components/shared/Toast.js'

export default defineComponent({
  name: 'NodeDetail',
  setup() {
    const route = useRoute()
    const nodes = useNodesStore()
    const toast = useToast()

    const node = ref(null)
    const stats = ref(null)
    const loadingStats = ref(false)
    const radioForm = ref({})
    const showRadioEdit = ref(false)

    const nodeId = Number(route.params.id)

    onMounted(async () => {
      try {
        node.value = await nodes.fetchOne(nodeId)
        radioForm.value = {
          name: node.value.self_info?.adv_name || '',
          freq: node.value.self_info?.radio_freq || '',
          bw: node.value.self_info?.radio_bw || '',
          sf: node.value.self_info?.radio_sf || '',
          cr: node.value.self_info?.radio_cr || '',
          tx_power: '',
        }
      } catch (e) {
        toast.error('Failed to load node')
      }
      await refreshStats()
    })

    async function refreshStats() {
      loadingStats.value = true
      try {
        stats.value = await nodes.fetchStats(nodeId)
      } catch {
        stats.value = null
      } finally {
        loadingStats.value = false
      }
    }

    async function saveRadioConfig() {
      try {
        await nodes.pushConfig(nodeId, radioForm.value)
        toast.success('Config sent to node')
        showRadioEdit.value = false
        node.value = await nodes.fetchOne(nodeId)
      } catch (e) {
        toast.error(e.message)
      }
    }

    function fmt(val, unit = '') {
      if (val == null) return '—'
      return `${val}${unit}`
    }

    return { node, stats, loadingStats, radioForm, showRadioEdit, refreshStats, saveRadioConfig, fmt }
  },
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <div v-if="!node" class="text-zinc-500 text-sm">Loading…</div>
      <template v-else>
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <router-link to="/nodes" class="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-sm">
              <Icon name="arrow-left" :size="14" /> Nodes
            </router-link>
            <span class="text-zinc-700">/</span>
            <h1 class="text-2xl font-bold text-white">{{ node.name }}</h1>
            <span :class="['w-2.5 h-2.5 rounded-full', node.connected ? 'bg-green-500' : 'bg-zinc-600']"></span>
          </div>
          <button @click="refreshStats" class="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl text-zinc-400 border border-white/[0.08] hover:bg-white/[0.05] transition-all">
            <Icon name="refresh" :size="14" /> Refresh Stats
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Self info -->
          <div class="glass rounded-xl p-5">
            <h2 class="font-semibold text-white mb-4">Node Identity</h2>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-zinc-500">Name</dt>
                <dd class="text-white font-mono">{{ node.self_info?.adv_name || '—' }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-zinc-500">Public Key (prefix)</dt>
                <dd class="text-white font-mono text-xs">{{ node.self_info?.public_key?.slice(0,24) || '—' }}…</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-zinc-500">Freq</dt>
                <dd class="text-white">{{ fmt(node.self_info?.radio_freq, ' MHz') }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-zinc-500">Bandwidth</dt>
                <dd class="text-white">{{ fmt(node.self_info?.radio_bw, ' kHz') }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-zinc-500">SF / CR</dt>
                <dd class="text-white">{{ fmt(node.self_info?.radio_sf) }} / {{ fmt(node.self_info?.radio_cr) }}</dd>
              </div>
            </dl>
            <button @click="showRadioEdit = true" class="mt-4 flex items-center gap-1 text-sm text-mesh-400 hover:text-mesh-300">Edit radio config <Icon name="arrow-right" :size="13" /></button>
          </div>

          <!-- Live stats -->
          <div class="glass rounded-xl p-5">
            <h2 class="font-semibold text-white mb-4">Live Stats</h2>
            <div v-if="loadingStats" class="text-zinc-500 text-sm">Loading…</div>
            <div v-else-if="!stats" class="text-zinc-600 text-sm">Node offline or stats unavailable</div>
            <template v-else>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <dt class="text-zinc-500">Battery</dt>
                  <dd class="text-white">{{ stats.battery?.level != null ? stats.battery.level + ' mV' : '—' }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-zinc-500">Uptime</dt>
                  <dd class="text-white">{{ stats.core?.uptime_secs != null ? Math.floor(stats.core.uptime_secs/3600) + 'h ' + Math.floor((stats.core.uptime_secs%3600)/60) + 'm' : '—' }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-zinc-500">Noise Floor</dt>
                  <dd class="text-white">{{ fmt(stats.radio?.noise_floor, ' dBm') }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-zinc-500">Last RSSI / SNR</dt>
                  <dd class="text-white">{{ fmt(stats.radio?.last_rssi, ' dBm') }} / {{ fmt(stats.radio?.last_snr != null ? stats.radio.last_snr.toFixed(1) : null, ' dB') }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-zinc-500">Packets RX / TX</dt>
                  <dd class="text-white">{{ fmt(stats.packets?.recv) }} / {{ fmt(stats.packets?.sent) }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-zinc-500">Errors</dt>
                  <dd :class="['', stats.core?.errors > 0 ? 'text-red-400' : 'text-white']">{{ fmt(stats.core?.errors) }}</dd>
                </div>
              </dl>
            </template>
          </div>
        </div>

        <!-- Radio config modal -->
        <Modal :show="showRadioEdit" title="Edit Radio Config" @close="showRadioEdit = false">
          <form @submit.prevent="saveRadioConfig" class="space-y-4">
            <div>
              <label class="block text-xs text-zinc-500 mb-1.5">Node Name</label>
              <input v-model="radioForm.name" type="text"
                class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-zinc-500 mb-1.5">Frequency (MHz)</label>
                <input v-model.number="radioForm.freq" type="number" step="0.001"
                  class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);" />
              </div>
              <div>
                <label class="block text-xs text-zinc-500 mb-1.5">Bandwidth (kHz)</label>
                <input v-model.number="radioForm.bw" type="number"
                  class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);" />
              </div>
              <div>
                <label class="block text-xs text-zinc-500 mb-1.5">Spreading Factor</label>
                <input v-model.number="radioForm.sf" type="number" min="7" max="12"
                  class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);" />
              </div>
              <div>
                <label class="block text-xs text-zinc-500 mb-1.5">Coding Rate (5-8)</label>
                <input v-model.number="radioForm.cr" type="number" min="5" max="8"
                  class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-zinc-500 mb-1.5">TX Power (dBm, leave blank to keep)</label>
              <input v-model.number="radioForm.tx_power" type="number"
                class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);" />
            </div>
            <p class="flex items-center gap-1.5 text-xs text-yellow-500"><Icon name="warning" :size="14" /> Incorrect radio settings may disconnect the node from the mesh.</p>
            <div class="flex justify-end gap-3 pt-1">
              <button type="button" @click="showRadioEdit = false" class="px-4 py-2 rounded-xl text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.05] transition-all">Cancel</button>
              <button type="submit" class="px-5 py-2 rounded-lg bg-mesh-600 hover:bg-mesh-500 text-white text-sm font-medium transition-colors">Send Config</button>
            </div>
          </form>
        </Modal>
      </template>
    </div>
  `,
})
