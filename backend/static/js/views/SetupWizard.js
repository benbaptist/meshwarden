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

    const step = ref(1)
    const username = ref('')
    const password = ref('')
    const confirmPassword = ref('')
    const loading = ref(false)
    const error = ref('')

    const strengthLevel = (pw) => {
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
    const strengthColor = (s) => ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'][s] || ''

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

    return { step, username, password, confirmPassword, loading, error, submit, strengthLevel, strengthLabel, strengthColor }
  },
  template: `
    <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-mesh-900 border border-mesh-700 mb-4">
            <span class="text-3xl">⬡</span>
          </div>
          <h1 class="text-3xl font-bold text-white">MeshWarden</h1>
          <p class="text-gray-400 mt-1">Initial Setup</p>
        </div>

        <div class="bg-gray-900 rounded-2xl border border-gray-700 p-8 shadow-2xl">
          <h2 class="text-lg font-semibold text-white mb-1">Create Admin Account</h2>
          <p class="text-gray-400 text-sm mb-6">
            This account is the only login for MeshWarden. Store your credentials safely.
          </p>

          <form @submit.prevent="submit" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-300 mb-1.5">Username</label>
              <input
                v-model="username"
                type="text"
                autocomplete="username"
                required
                class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-mesh-500 transition-colors text-sm"
                placeholder="admin"
              />
            </div>

            <div>
              <label class="block text-sm text-gray-300 mb-1.5">Password</label>
              <input
                v-model="password"
                type="password"
                autocomplete="new-password"
                required
                class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-mesh-500 transition-colors text-sm"
                placeholder="At least 12 characters"
              />
              <!-- Strength meter -->
              <div class="mt-2 flex gap-1 h-1" v-if="password">
                <div
                  v-for="i in 5" :key="i"
                  :class="['flex-1 rounded-full transition-colors', i <= strengthLevel(password) ? strengthColor(strengthLevel(password)) : 'bg-gray-700']"
                ></div>
              </div>
              <div class="text-xs text-gray-500 mt-1" v-if="password">{{ strengthLabel(strengthLevel(password)) }}</div>
            </div>

            <div>
              <label class="block text-sm text-gray-300 mb-1.5">Confirm Password</label>
              <input
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                required
                class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-mesh-500 transition-colors text-sm"
                placeholder="Repeat password"
              />
            </div>

            <div v-if="error" class="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-3 rounded-lg bg-mesh-600 hover:bg-mesh-500 disabled:opacity-60 text-white font-medium transition-colors text-sm mt-2"
            >
              <span v-if="loading">Setting up…</span>
              <span v-else">Create Account &amp; Continue</span>
            </button>
          </form>
        </div>

        <p class="text-center text-xs text-gray-600 mt-4">
          MeshWarden &mdash; open-source MeshCore dashboard
        </p>
      </div>
    </div>
  `,
})
