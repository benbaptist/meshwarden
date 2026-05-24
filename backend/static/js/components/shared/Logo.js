import { defineComponent } from 'vue'

// Pointy-top regular hexagon SVG (like ⬡), used as the MeshWarden logo mark.
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
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <!-- Hexagon outline -->
      <path d="M12 2 L20.66 7 L20.66 17 L12 22 L3.34 17 L3.34 7 Z" />
      <!-- Center dot -->
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  `,
})
