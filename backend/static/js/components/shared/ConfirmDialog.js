import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'ConfirmDialog',
  props: {
    show: { type: Boolean, default: false },
    title: { type: String, default: 'Confirm' },
    message: { type: String, default: 'Are you sure?' },
    confirmLabel: { type: String, default: 'Confirm' },
    danger: { type: Boolean, default: false },
  },
  emits: ['confirm', 'cancel'],
  template: `
    <teleport to="body">
      <transition name="fade">
        <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="$emit('cancel')"></div>
          <div class="relative w-full max-w-sm rounded-2xl shadow-2xl p-6" style="background: #0f0f18; border: 1px solid rgba(255,255,255,0.08);">
            <h3 class="text-base font-bold text-white mb-2">{{ title }}</h3>
            <p class="text-zinc-400 text-sm mb-6">{{ message }}</p>
            <div class="flex justify-end gap-3">
              <button
                @click="$emit('cancel')"
                class="px-4 py-2 rounded-xl text-sm text-zinc-400 transition-all hover:bg-white/[0.05]" style="border: 1px solid rgba(255,255,255,0.08);"
              >Cancel</button>
              <button
                @click="$emit('confirm')"
                :class="['px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all', danger ? 'bg-rose-600 hover:bg-rose-500' : '']"
                :style="!danger ? 'background: linear-gradient(135deg, #7c3aed, #9333ea);' : ''"
              >{{ confirmLabel }}</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  `,
})
