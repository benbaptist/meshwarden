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
          <div class="relative w-full max-w-sm rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-6">
            <h3 class="text-lg font-semibold text-white mb-2">{{ title }}</h3>
            <p class="text-gray-300 text-sm mb-6">{{ message }}</p>
            <div class="flex justify-end gap-3">
              <button
                @click="$emit('cancel')"
                class="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 text-sm transition-colors"
              >Cancel</button>
              <button
                @click="$emit('confirm')"
                :class="['px-4 py-2 rounded-lg text-sm font-medium transition-colors', danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-mesh-600 hover:bg-mesh-500 text-white']"
              >{{ confirmLabel }}</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  `,
})
