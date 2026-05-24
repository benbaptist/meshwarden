import { defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useNodesStore } from '../stores/nodes.js'
import { useContactsStore } from '../stores/contacts.js'
import { useMessagesStore } from '../stores/messages.js'

export default defineComponent({
  name: 'Login',
  setup() {
    const auth = useAuthStore()
    const nodes = useNodesStore()
    const contacts = useContactsStore()
    const messages = useMessagesStore()
    const router = useRouter()

    const username = ref('')
    const password = ref('')
    const loading = ref(false)
    const error = ref('')

    async function submit() {
      error.value = ''
      loading.value = true
      try {
        await auth.login(username.value, password.value)
        await nodes.fetchAll()
        nodes.bindSocket()
        contacts.fetchAll()
        contacts.bindSocket()
        messages.bindSocket()
        router.push('/')
      } catch (e) {
        error.value = 'Invalid username or password'
      } finally {
        loading.value = false
      }
    }

    return { username, password, loading, error, submit }
  },
  template: `
    <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-mesh-900 border border-mesh-700 mb-4">
            <span class="text-2xl">⬡</span>
          </div>
          <h1 class="text-2xl font-bold text-white">MeshWarden</h1>
        </div>

        <div class="bg-gray-900 rounded-2xl border border-gray-700 p-7 shadow-2xl">
          <form @submit.prevent="submit" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-300 mb-1.5">Username</label>
              <input
                v-model="username"
                type="text"
                autocomplete="username"
                required
                autofocus
                class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-mesh-500 transition-colors text-sm"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-300 mb-1.5">Password</label>
              <input
                v-model="password"
                type="password"
                autocomplete="current-password"
                required
                class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-mesh-500 transition-colors text-sm"
              />
            </div>

            <div v-if="error" class="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-3 rounded-lg bg-mesh-600 hover:bg-mesh-500 disabled:opacity-60 text-white font-medium transition-colors text-sm"
            >
              {{ loading ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
})
