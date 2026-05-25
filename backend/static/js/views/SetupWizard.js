import { defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../components/shared/Toast.js'

export default defineComponent({
  name: 'SetupWizard',
  setup() {
    const auth = useAuthStore()
    const router = useRouter()
    const toast = useToast()

    const username = ref('')
    const password = ref('')
    const confirmPassword = ref('')
    const loading = ref(false)
    const error = ref('')

    function strengthLevel(pw) {
      if (!pw) return 0
      let s = 0
      if (pw.length >= 12) s++
      if (pw.length >= 16) s++
      if (/[A-Z]/.test(pw)) s++
      if (/[0-9]/.test(pw)) s++
      if (/[^A-Za-z0-9]/.test(pw)) s++
      return s
    }
    const strengthLabel = (s) => ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][s] || ''
    const strengthColor = (s) => ['', '#ef4444', '#f97316', '#eab308', '#3b82f6', '#22c55e'][s] || ''

    async function submit() {
      error.value = ''
      if (username.value.length < 3) { error.value = 'Username must be at least 3 characters'; return }
      if (password.value.length < 12) { error.value = 'Password must be at least 12 characters'; return }
      if (password.value !== confirmPassword.value) { error.value = 'Passwords do not match'; return }
      loading.value = true
      try {
        await auth.setup(username.value, password.value)
        toast.success('MeshWarden is ready!')
        router.push('/')
      } catch (e) {
        error.value = e.message
      } finally {
        loading.value = false
      }
    }

    return { username, password, confirmPassword, loading, error, submit, strengthLevel, strengthLabel, strengthColor }
  },
  template: `
    <div class="min-h-screen app-bg flex items-center justify-center p-4">
      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <div
            class="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style="background: rgba(124,58,237,0.15); border: 1px solid rgba(139,92,246,0.3);"
          >
            <span class="text-violet-400"><Logo :size="28" /></span>
          </div>
          <h1 class="text-2xl font-bold text-white tracking-tight">MeshWarden</h1>
          <p class="text-zinc-500 text-sm mt-1">Initial setup</p>
        </div>

        <div class="glass rounded-3xl p-7 shadow-2xl">
          <div class="text-sm font-semibold text-zinc-200 mb-1">Create Admin Account</div>
          <p class="text-xs text-zinc-500 mb-5 leading-relaxed">This is the only login. Store your credentials safely — they cannot be recovered.</p>

          <form @submit.prevent="submit" class="space-y-3">
            <div>
              <label class="block text-xs text-zinc-400 mb-1.5 font-medium">Username</label>
              <input
                v-model="username"
                type="text"
                autocomplete="username"
                required
                placeholder="admin"
                class="w-full px-4 py-2.5 rounded-xl text-white placeholder-zinc-600 text-sm outline-none transition-all"
                style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
              />
            </div>

            <div>
              <label class="block text-xs text-zinc-400 mb-1.5 font-medium">Password</label>
              <input
                v-model="password"
                type="password"
                autocomplete="new-password"
                required
                placeholder="At least 12 characters"
                class="w-full px-4 py-2.5 rounded-xl text-white placeholder-zinc-600 text-sm outline-none transition-all"
                style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
              />
              <div v-if="password" class="mt-2 flex gap-1 h-1">
                <div
                  v-for="i in 5" :key="i"
                  class="flex-1 rounded-full transition-all"
                  :style="{ background: i <= strengthLevel(password) ? strengthColor(strengthLevel(password)) : 'rgba(255,255,255,0.08)' }"
                ></div>
              </div>
              <div v-if="password" class="text-[10px] text-zinc-600 mt-1">{{ strengthLabel(strengthLevel(password)) }}</div>
            </div>

            <div>
              <label class="block text-xs text-zinc-400 mb-1.5 font-medium">Confirm Password</label>
              <input
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                required
                placeholder="Repeat password"
                class="w-full px-4 py-2.5 rounded-xl text-white placeholder-zinc-600 text-sm outline-none transition-all"
                style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
              />
            </div>

            <div v-if="error" class="text-rose-400 text-xs rounded-xl px-3 py-2.5" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2);">
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
            >{{ loading ? 'Setting up…' : 'Create Account' }}</button>
          </form>
        </div>
      </div>
    </div>
  `,
})
