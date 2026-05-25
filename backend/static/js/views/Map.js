import { defineComponent, ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useNodesStore } from '../stores/nodes.js'
import { useContactsStore } from '../stores/contacts.js'

const TYPE_COLORS = {
  CLI:  '#a78bfa',  // violet
  REP:  '#22d3ee',  // cyan
  ROOM: '#fbbf24',  // amber
  SENS: '#34d399',  // emerald
  NONE: '#71717a',  // zinc
}

export default defineComponent({
  name: 'MapView',
  setup() {
    const nodes = useNodesStore()
    const contacts = useContactsStore()

    const mapEl = ref(null)
    let map = null
    const markerMap = new Map()
    let initFit = false

    const geoContacts = computed(() =>
      contacts.contacts.filter(
        (c) => c.lat != null && c.lon != null && c.node_id === nodes.activeNodeId
      )
    )

    function makeIcon(contact) {
      const color = TYPE_COLORS[contact.contact_type_name] || TYPE_COLORS.NONE
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
        <circle cx="12" cy="11" r="9" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.5"/>
        <circle cx="12" cy="11" r="4" fill="${color}"/>
        <line x1="12" y1="20" x2="12" y2="30" stroke="${color}" stroke-opacity="0.4" stroke-width="1.5" stroke-dasharray="2,2"/>
      </svg>`
      return window.L.divIcon({ html: svg, className: '', iconSize: [24, 32], iconAnchor: [12, 30], popupAnchor: [0, -32] })
    }

    function initMap() {
      if (!mapEl.value || map) return
      map = window.L.map(mapEl.value, { zoomControl: false }).setView([20, 0], 2)
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)
      window.L.control.zoom({ position: 'bottomright' }).addTo(map)
    }

    function updateMarkers() {
      if (!map) return
      const current = new Set()

      for (const c of geoContacts.value) {
        current.add(c.id)
        if (markerMap.has(c.id)) {
          markerMap.get(c.id).setLatLng([c.lat, c.lon])
        } else {
          const m = window.L.marker([c.lat, c.lon], { icon: makeIcon(c) })
            .addTo(map)
            .bindPopup(
              `<div style="font-weight:600;color:#f4f4f5">${c.adv_name || 'Unknown'}</div>` +
              `<div style="color:${TYPE_COLORS[c.contact_type_name] || TYPE_COLORS.NONE};font-size:11px;margin-top:2px">${c.contact_type_name}</div>`
            )
          markerMap.set(c.id, m)
        }
      }

      // Remove stale markers
      for (const [id, m] of markerMap) {
        if (!current.has(id)) { m.remove(); markerMap.delete(id) }
      }

      // Auto-fit on first load when markers appear
      if (!initFit && geoContacts.value.length > 0 && markerMap.size > 0) {
        const lls = [...markerMap.values()].map((m) => m.getLatLng())
        map.fitBounds(window.L.latLngBounds(lls), { padding: [60, 60], maxZoom: 14 })
        initFit = true
      }
    }

    onMounted(() => {
      initMap()
      updateMarkers()
    })

    onBeforeUnmount(() => {
      if (map) { map.remove(); map = null; markerMap.clear(); initFit = false }
    })

    watch(geoContacts, updateMarkers)

    // Re-init on node switch (initFit should reset so we re-center)
    watch(() => nodes.activeNodeId, () => {
      initFit = false
      updateMarkers()
    })

    return { nodes, contacts, geoContacts }
  },
  template: `
    <div class="h-full relative overflow-hidden">
      <div ref="mapEl" class="absolute inset-0 z-0"></div>

      <!-- Status overlay — top left -->
      <div class="absolute top-3 left-3 z-[500] space-y-2 pointer-events-none">
        <!-- Onboarding: no nodes -->
        <div v-if="!nodes.nodes.length" class="glass rounded-2xl p-4 max-w-xs pointer-events-auto">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);">
              <Icon name="cpu-chip" :size="17" class="text-violet-400" />
            </div>
            <div>
              <div class="text-sm font-semibold text-white">Connect a node</div>
              <div class="text-xs text-zinc-400 mt-1 leading-relaxed">Add a MeshCore node in Settings to start seeing your mesh on the map.</div>
              <router-link to="/settings" class="mt-2 inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Open Settings <Icon name="chevron-right" :size="11" />
              </router-link>
            </div>
          </div>
        </div>

        <!-- Active node pill -->
        <div v-else-if="nodes.activeNode" class="glass rounded-xl px-3 py-2 flex items-center gap-2.5 min-w-[160px]">
          <div :class="['w-2 h-2 rounded-full flex-shrink-0', nodes.activeNode.connected ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]' : 'bg-zinc-600']"></div>
          <div>
            <div class="text-sm font-semibold text-white">{{ nodes.activeNode.name }}</div>
            <div class="text-[10px] text-zinc-500 mt-0.5">
              <span v-if="geoContacts.length">{{ geoContacts.length }} on map</span>
              <span v-else>no GPS positions</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Hint when contacts exist but none have GPS -->
      <div
        v-if="nodes.activeNode && contacts.contacts.length > 0 && geoContacts.length === 0"
        class="absolute bottom-20 left-1/2 -translate-x-1/2 z-[500] glass rounded-xl px-5 py-3 text-center pointer-events-none"
      >
        <div class="text-sm font-medium text-zinc-300">No GPS positions yet</div>
        <div class="text-xs text-zinc-500 mt-0.5">Contacts with location data will appear here.</div>
      </div>
    </div>
  `,
})
