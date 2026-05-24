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
    <div class="px-4 pt-6 pb-8 max-w-lg mx-auto">
      <h1 class="text-2xl font-bold text-white mb-6">Settings</h1>

      <!-- Change Password -->
      <div class="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Change Password</h2>
        <form @submit.prevent="changePassword" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Current Password</label>
            <input v-model="currentPassword" type="password" required autocomplete="current-password"
              class="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">New Password</label>
            <input v-model="newPassword" type="password" required autocomplete="new-password"
              class="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Confirm New Password</label>
            <input v-model="confirmPassword" type="password" required autocomplete="new-password"
              class="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500" />
          </div>
          <p class="text-xs text-gray-600">Must be at least 12 characters. Changing your password will revoke all active sessions.</p>
          <button type="submit" :disabled="savingPassword" class="w-full py-3 rounded-xl bg-mesh-600 hover:bg-mesh-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {{ savingPassword ? 'Saving…' : 'Change Password' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
