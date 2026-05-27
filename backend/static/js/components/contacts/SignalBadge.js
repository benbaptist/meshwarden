import { defineComponent, computed } from 'vue'

export default defineComponent({
  name: 'SignalBadge',
  props: {
    snr: { type: Number, default: null },
    rssi: { type: Number, default: null },
  },
  setup(props) {
    const quality = computed(() => {
      if (props.snr == null) return null
      if (props.snr >= 8)  return { label: 'Excellent', cls: 'bg-emerald-500/15 text-emerald-400' }
      if (props.snr >= 3)  return { label: 'Good',      cls: 'bg-emerald-500/10 text-emerald-500' }
      if (props.snr >= -3) return { label: 'Fair',      cls: 'bg-amber-500/15 text-amber-400' }
      return                      { label: 'Weak',      cls: 'bg-rose-500/15 text-rose-400' }
    })
    return { quality }
  },
  template: `
    <span
      v-if="quality"
      :class="['inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono', quality.cls]"
      :title="rssi != null ? \`RSSI: \${rssi} dBm\` : ''"
    >
      {{ snr != null ? snr.toFixed(1) + ' dB' : '' }}
    </span>
  `,
})
