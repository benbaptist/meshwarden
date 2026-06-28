import { defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

export default defineComponent({
  name: 'Offline',
  setup() {
    const auth = useAuthStore()
    const router = useRouter()
    const retrying = ref(false)

    async function retry() {
      retrying.value = true
      auth.setupChecked = false
      await auth.checkSetup()
      retrying.value = false
      if (auth.serverReachable) {
        router.push('/')
      }
    }

    return { retrying, retry }
  },
  template: `
    <div class="h-full flex flex-col items-center justify-center px-6 text-center app-bg">
      <div class="glass rounded-2xl p-10 max-w-sm w-full flex flex-col items-center gap-6">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.2);">
          <Icon name="signal-slash" :size="28" class="text-rose-400" />
        </div>
        <div class="flex flex-col gap-2">
          <h1 class="text-xl font-bold text-zinc-100">Server Unreachable</h1>
          <p class="text-sm text-zinc-400 leading-relaxed">
            MeshWarden cannot connect to the backend server. Check that the server is running and your network connection is active.
          </p>
        </div>
        <button
          @click="retry"
          :disabled="retrying"
          class="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
        >
          <span v-if="retrying" class="flex items-center justify-center gap-2">
            <Spinner :size="16" /> Retrying…
          </span>
          <span v-else>Retry Connection</span>
        </button>
      </div>
    </div>
  `,
})
