import { defineComponent, ref } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useNodesStore } from '../stores/nodes.js'
import { useToast } from '../components/shared/Toast.js'

const EMPTY_FORM = () => ({ name: '', connection_type: 'tcp', host: '', port: 5525, device_path: '' })

export default defineComponent({
  name: 'Settings',
  setup() {
    const auth = useAuthStore()
    const nodes = useNodesStore()
    const toast = useToast()

    // Password
    const currentPassword = ref('')
    const newPassword = ref('')
    const confirmPassword = ref('')
    const savingPassword = ref(false)

    async function changePassword() {
      if (newPassword.value !== confirmPassword.value) { toast.error('Passwords do not match'); return }
      if (newPassword.value.length < 12) { toast.error('Password must be at least 12 characters'); return }
      savingPassword.value = true
      try {
        await auth.changePassword(currentPassword.value, newPassword.value)
        toast.success('Password changed — you will be logged out.')
        currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
      } catch (e) {
        toast.error(e.message)
      } finally {
        savingPassword.value = false
      }
    }

    // Node management
    const showModal = ref(false)
    const editingNode = ref(null)
    const nodeForm = ref(EMPTY_FORM())
    const savingNode = ref(false)
    const confirmDelete = ref(null) // node to delete

    function openAdd() {
      editingNode.value = null
      nodeForm.value = EMPTY_FORM()
      showModal.value = true
    }

    function openEdit(node) {
      editingNode.value = node
      nodeForm.value = {
        name: node.name,
        connection_type: node.connection_type,
        host: node.host || '',
        port: node.port || 5525,
        device_path: node.device_path || '',
      }
      showModal.value = true
    }

    function closeModal() { showModal.value = false; editingNode.value = null; nodeForm.value = EMPTY_FORM() }

    async function saveNode() {
      const data = { ...nodeForm.value }
      if (data.connection_type === 'tcp') delete data.device_path
      else { delete data.host; delete data.port }
      savingNode.value = true
      try {
        if (editingNode.value) {
          await nodes.update(editingNode.value.id, data)
          toast.success('Node updated')
        } else {
          await nodes.create(data)
          toast.success('Node added')
        }
        closeModal()
      } catch (e) {
        toast.error(e.message || 'Failed to save node')
      } finally {
        savingNode.value = false
      }
    }

    async function deleteNode(node) {
      try {
        await nodes.remove(node.id)
        toast.success(`"${node.name}" removed`)
        confirmDelete.value = null
      } catch (e) {
        toast.error(e.message || 'Failed to delete node')
      }
    }

    async function toggleConnect(node) {
      try {
        if (node.connected) await nodes.disconnect(node.id)
        else await nodes.connect(node.id)
      } catch (e) {
        toast.error(e.message || 'Failed')
      }
    }

    const INPUT = 'w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all'
    const INPUT_STYLE = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);'

    return {
      auth, nodes,
      currentPassword, newPassword, confirmPassword, savingPassword, changePassword,
      showModal, editingNode, nodeForm, savingNode, openAdd, openEdit, closeModal, saveNode,
      confirmDelete, deleteNode, toggleConnect,
      INPUT, INPUT_STYLE,
    }
  },
  template: `
    <div class="px-4 pt-6 pb-20 max-w-xl mx-auto space-y-6">
      <h1 class="text-lg font-bold text-white">Settings</h1>

      <!-- ── Nodes section ── -->
      <section>
        <div class="flex items-center justify-between mb-3">
          <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Nodes</div>
          <button
            @click="openAdd"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white transition-all"
            style="background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.3);"
          >
            <Icon name="plus" :size="13" /> Add Node
          </button>
        </div>

        <div v-if="!nodes.nodes.length" class="glass rounded-2xl p-6 text-center text-zinc-500 text-sm">
          No nodes configured. Add your first MeshCore node above.
        </div>

        <div v-else class="space-y-2.5">
          <div
            v-for="node in nodes.nodes"
            :key="node.id"
            class="glass rounded-2xl p-4"
            :class="node.id === nodes.activeNodeId ? 'ring-1 ring-violet-500/30' : ''"
          >
            <div class="flex items-center gap-3 mb-3">
              <div :class="['w-2.5 h-2.5 rounded-full flex-shrink-0', node.connected ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]' : 'bg-zinc-700']"></div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold text-white truncate">{{ node.name }}</span>
                  <span v-if="node.id === nodes.activeNodeId" class="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-400 border border-violet-500/20">active</span>
                </div>
                <div class="text-xs text-zinc-600 mt-0.5">
                  <span v-if="node.connection_type === 'tcp'">TCP · {{ node.host }}:{{ node.port }}</span>
                  <span v-else>Serial · {{ node.device_path }}</span>
                  · <span :class="node.connected ? 'text-cyan-500' : 'text-zinc-600'">{{ node.connected ? 'connected' : 'offline' }}</span>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-4 gap-1.5">
              <button
                @click="toggleConnect(node)"
                :class="['col-span-2 py-2 rounded-xl text-xs font-medium transition-all', node.connected ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/15' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/15']"
              >{{ node.connected ? 'Disconnect' : 'Connect' }}</button>

              <button
                v-if="node.id !== nodes.activeNodeId"
                @click="nodes.setActive(node.id)"
                class="py-2 rounded-xl text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/15 transition-all"
              >Set active</button>
              <div v-else></div>

              <div class="flex gap-1">
                <button
                  @click="openEdit(node)"
                  class="flex-1 py-2 rounded-xl text-xs text-zinc-400 border border-white/[0.08] hover:bg-white/[0.06] transition-all flex items-center justify-center"
                ><Icon name="pencil" :size="13" /></button>
                <button
                  @click="confirmDelete = node"
                  class="flex-1 py-2 rounded-xl text-xs text-rose-500 border border-white/[0.08] hover:bg-rose-500/10 transition-all flex items-center justify-center"
                ><Icon name="trash" :size="13" /></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Account section ── -->
      <section>
        <div class="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-3">Account</div>
        <div class="glass rounded-2xl p-5">
          <div class="text-sm font-medium text-zinc-300 mb-4">Change Password</div>
          <form @submit.prevent="changePassword" class="space-y-3" autocomplete="off">
            <input v-model="currentPassword" type="password" placeholder="Current password" required autocomplete="off"
              :class="INPUT" :style="INPUT_STYLE" />
            <input v-model="newPassword" type="password" placeholder="New password (min 12 chars)" required autocomplete="off"
              :class="INPUT" :style="INPUT_STYLE" />
            <input v-model="confirmPassword" type="password" placeholder="Confirm new password" required autocomplete="off"
              :class="INPUT" :style="INPUT_STYLE" />
            <button
              type="submit"
              :disabled="savingPassword"
              class="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
            >{{ savingPassword ? 'Saving…' : 'Change Password' }}</button>
          </form>
        </div>
      </section>
    </div>

    <!-- Node add/edit modal -->
    <Modal v-if="showModal" :show="true" @close="closeModal">
      <div class="p-6 w-full max-w-md">
        <h2 class="text-base font-bold text-white mb-5">{{ editingNode ? 'Edit Node' : 'Add Node' }}</h2>
        <form @submit.prevent="saveNode" class="space-y-3" autocomplete="off">
          <div>
            <label class="block text-xs text-zinc-500 mb-1.5">Name</label>
            <input v-model="nodeForm.name" type="text" required placeholder="My Node"
              :class="INPUT" :style="INPUT_STYLE" />
          </div>
          <div>
            <label class="block text-xs text-zinc-500 mb-1.5">Connection Type</label>
            <select
              v-model="nodeForm.connection_type"
              :class="INPUT" :style="INPUT_STYLE"
            >
              <option value="tcp">TCP / Network</option>
              <option value="serial">Serial / USB</option>
            </select>
          </div>
          <template v-if="nodeForm.connection_type === 'tcp'">
            <div>
              <label class="block text-xs text-zinc-500 mb-1.5">Host</label>
              <input v-model="nodeForm.host" type="text" required placeholder="192.168.1.100"
                :class="INPUT" :style="INPUT_STYLE" />
            </div>
            <div>
              <label class="block text-xs text-zinc-500 mb-1.5">Port</label>
              <input v-model.number="nodeForm.port" type="number" required min="1" max="65535"
                :class="INPUT" :style="INPUT_STYLE" />
            </div>
          </template>
          <template v-else>
            <div>
              <label class="block text-xs text-zinc-500 mb-1.5">Device Path</label>
              <input v-model="nodeForm.device_path" type="text" required placeholder="/dev/ttyUSB0"
                :class="INPUT" :style="INPUT_STYLE" />
            </div>
          </template>
          <div class="flex gap-2 pt-2">
            <button type="button" @click="closeModal"
              class="flex-1 py-2.5 rounded-xl text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.05] transition-all">
              Cancel
            </button>
            <button type="submit" :disabled="savingNode"
              class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style="background: linear-gradient(135deg, #7c3aed, #9333ea);">
              {{ savingNode ? 'Saving…' : (editingNode ? 'Save Changes' : 'Add Node') }}
            </button>
          </div>
        </form>
      </div>
    </Modal>

    <!-- Delete confirmation -->
    <ConfirmDialog
      v-if="confirmDelete"
      :show="true"
      :title="\`Delete \${confirmDelete.name}?\`"
      message="This will permanently remove the node and all its data. This cannot be undone."
      confirm-label="Delete"
      :danger="true"
      @confirm="deleteNode(confirmDelete)"
      @cancel="confirmDelete = null"
    />
  `,
})

