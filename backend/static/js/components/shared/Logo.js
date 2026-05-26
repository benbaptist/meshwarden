import { defineComponent } from 'vue'

// Radar/beacon logo mark mirroring the PWA app icon design.
export default defineComponent({
  name: 'Logo',
  props: {
    size: { type: [Number, String], default: 32 },
  },
  template: `
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <!-- Outer ring -->
      <circle cx="12" cy="12" r="5" stroke-width="1.5" />
      <!-- Center dot -->
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <!-- Signal lines radiating outward -->
      <line x1="12" y1="7"   x2="12" y2="4.5"   stroke-width="1.5" />
      <line x1="15.5" y1="8.5" x2="17.5" y2="6.5" stroke-width="1" opacity="0.6" />
      <line x1="17"  y1="12"  x2="19.5" y2="12"  stroke-width="1" opacity="0.6" />
      <line x1="8.5" y1="8.5" x2="6.5"  y2="6.5"  stroke-width="1" opacity="0.6" />
      <line x1="7"   y1="12"  x2="4.5"  y2="12"  stroke-width="1" opacity="0.6" />
    </svg>
  `,
})
