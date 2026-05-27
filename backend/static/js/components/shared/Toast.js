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
    const typeConfig = {
      success: { icon: 'check-circle',       accent: '#34d399' },
      error:   { icon: 'x-circle',           accent: '#fb7185' },
      info:    { icon: 'information-circle', accent: '#a78bfa' },
      warn:    { icon: 'warning',             accent: '#f59e0b' },
    }
    return { toasts, typeConfig }
  },
  template: `
    <div class="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <transition-group name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm shadow-2xl pointer-events-auto min-w-[240px] max-w-sm"
          :style="{
            background: 'rgba(15,15,24,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderLeft: '3px solid ' + typeConfig[t.type].accent,
          }"
        >
          <Icon :name="typeConfig[t.type].icon" :size="18" :style="{ color: typeConfig[t.type].accent }" class="flex-shrink-0" />
          <span class="text-zinc-100">{{ t.message }}</span>
        </div>
      </transition-group>
    </div>
  `,
})
