import { defineComponent } from 'vue'

export default defineComponent({
  name: 'Modal',
  props: {
    show: { type: Boolean, default: false },
    title: { type: String, default: '' },
    maxWidth: { type: String, default: 'max-w-lg' },
  },
  emits: ['close'],
  template: `
    <teleport to="body">
      <transition name="fade">
        <div
          v-if="show"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="$emit('close')"
        >
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="$emit('close')"></div>
          <div :class="['relative w-full rounded-2xl shadow-2xl', maxWidth]" style="background: #0f0f18; border: 1px solid rgba(255,255,255,0.08);">
            <div v-if="title" class="flex items-center justify-between px-6 py-4" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
              <h2 class="text-base font-bold text-white">{{ title }}</h2>
              <button
                @click="$emit('close')"
                class="text-zinc-500 hover:text-zinc-200 transition-colors text-xl leading-none"
              >&times;</button>
            </div>
            <div class="px-6 py-5">
              <slot />
            </div>
            <div v-if="$slots.footer" class="px-6 py-4 flex justify-end gap-3" style="border-top: 1px solid rgba(255,255,255,0.06);">
              <slot name="footer" />
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  `,
})
