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
      if (props.snr >= 8)  return { label: 'Excellent', cls: 'bg-green-900 text-green-400' }
      if (props.snr >= 3)  return { label: 'Good',      cls: 'bg-blue-900 text-blue-400' }
      if (props.snr >= -3) return { label: 'Fair',      cls: 'bg-yellow-900 text-yellow-400' }
      return                      { label: 'Weak',      cls: 'bg-red-900 text-red-400' }
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
