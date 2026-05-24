import { defineComponent, ref, provide } from 'vue'

// Simple global toast system
const toasts = ref([])
let _nextId = 1

export function useToast() {
  function show(message, type = 'info', duration = 4000) {
    const id = _nextId++
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, duration)
  }
  return {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error'),
    info: (msg) => show(msg, 'info'),
    warn: (msg) => show(msg, 'warn'),
  }
}

export default defineComponent({
  name: 'AppToast',
  setup() {
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warn: '⚠',
    }
    const colors = {
      success: 'bg-green-800 border-green-600 text-green-100',
      error: 'bg-red-900 border-red-600 text-red-100',
      info: 'bg-gray-800 border-gray-600 text-gray-100',
      warn: 'bg-yellow-900 border-yellow-600 text-yellow-100',
    }
    return { toasts, icons, colors }
  },
  template: `
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <transition-group name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="['flex items-center gap-3 px-4 py-3 rounded-lg border text-sm shadow-xl pointer-events-auto min-w-[240px] max-w-sm', colors[t.type]]"
        >
          <span class="font-bold text-base flex-shrink-0">{{ icons[t.type] }}</span>
          <span>{{ t.message }}</span>
        </div>
      </transition-group>
    </div>
  `,
})
