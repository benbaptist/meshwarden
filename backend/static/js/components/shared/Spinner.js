import { defineComponent, h } from 'vue'

export default defineComponent({
  name: 'Spinner',
  props: {
    size: { type: String, default: 'md' },
  },
  setup(props) {
    const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
    return () => h('div', {
      class: `${sizes[props.size] || sizes.md} animate-spin rounded-full border-2 border-zinc-700 border-t-mesh-500`,
      role: 'status',
      'aria-label': 'Loading',
    })
  },
})
