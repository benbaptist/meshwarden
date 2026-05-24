import { defineComponent, ref } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../components/shared/Toast.js'

export default defineComponent({
  name: 'Settings',
  setup() {
    const auth = useAuthStore()
    const toast = useToast()

    const currentPassword = ref('')
    const newPassword = ref('')
    const confirmPassword = ref('')
    const savingPassword = ref(false)

    async function changePassword() {
      if (newPassword.value !== confirmPassword.value) {
        toast.error('Passwords do not match')
        return
      }
      if (newPassword.value.length < 12) {
        toast.error('Password must be at least 12 characters')
        return
      }
      savingPassword.value = true
      try {
        await auth.changePassword(currentPassword.value, newPassword.value)
        toast.success('Password changed. You will be logged out.')
        currentPassword.value = ''
        newPassword.value = ''
        confirmPassword.value = ''
      } catch (e) {
        toast.error(e.message)
      } finally {
        savingPassword.value = false
      }
    }

    return { currentPassword, newPassword, confirmPassword, savingPassword, changePassword }
  },
  template: `
    <div class="p-6 max-w-2xl mx-auto space-y-8">
      <h1 class="text-2xl font-bold text-white">Settings</h1>

      <!-- Change Password -->
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 class="text-base font-semibold text-white mb-4">Change Password</h2>
        <form @submit.prevent="changePassword" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Current Password</label>
            <input v-model="currentPassword" type="password" required autocomplete="current-password"
              class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">New Password</label>
            <input v-model="newPassword" type="password" required autocomplete="new-password"
              class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Confirm New Password</label>
            <input v-model="confirmPassword" type="password" required autocomplete="new-password"
              class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500" />
          </div>
          <p class="text-xs text-gray-600">Must be at least 12 characters. Changing your password will revoke all active sessions.</p>
          <div class="flex justify-end">
            <button type="submit" :disabled="savingPassword" class="px-5 py-2 rounded-lg bg-mesh-600 hover:bg-mesh-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {{ savingPassword ? 'Saving…' : 'Change Password' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Info -->
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 class="text-base font-semibold text-white mb-3">Security Notes</h2>
        <ul class="text-sm text-gray-500 space-y-2 list-disc list-inside">
          <li>Access tokens expire after 15 minutes and are refreshed automatically.</li>
          <li>Refresh tokens rotate on every use and expire after 30 days.</li>
          <li>Set <code class="text-gray-400 font-mono">ALLOWED_ORIGINS</code> in your environment to restrict cross-origin access.</li>
          <li>Set <code class="text-gray-400 font-mono">SECRET_KEY</code> to a strong random value in production.</li>
        </ul>
      </div>
    </div>
  `,
})
