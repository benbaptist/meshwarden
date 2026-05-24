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
          <div :class="['relative w-full rounded-xl bg-gray-900 border border-gray-700 shadow-2xl', maxWidth]">
            <div v-if="title" class="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 class="text-lg font-semibold text-white">{{ title }}</h2>
              <button
                @click="$emit('close')"
                class="text-gray-400 hover:text-white transition-colors text-xl leading-none"
              >&times;</button>
            </div>
            <div class="px-6 py-5">
              <slot />
            </div>
            <div v-if="$slots.footer" class="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <slot name="footer" />
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  `,
})
