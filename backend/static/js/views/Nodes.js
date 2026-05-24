import { defineComponent, ref, onMounted } from 'vue'
import { useNodesStore } from '../stores/nodes.js'
import { useToast } from '../components/shared/Toast.js'

export default defineComponent({
  name: 'Nodes',
  setup() {
    const nodes = useNodesStore()
    const toast = useToast()

    const showForm = ref(false)
    const editingNode = ref(null)
    const confirmDelete = ref(null)
    const form = ref({ name: '', connection_type: 'tcp', host: '', port: 4403, device_path: '', baud_rate: 115200, enabled: true })

    onMounted(() => nodes.fetchAll())

    function openCreate() {
      editingNode.value = null
      form.value = { name: '', connection_type: 'tcp', host: '', port: 4403, device_path: '', baud_rate: 115200, enabled: true }
      showForm.value = true
    }

    function openEdit(node) {
      editingNode.value = node
      form.value = { ...node }
      showForm.value = true
    }

    async function save() {
      try {
        if (editingNode.value) {
          await nodes.update(editingNode.value.id, form.value)
          toast.success('Node updated')
        } else {
          await nodes.create(form.value)
          toast.success('Node added')
        }
        showForm.value = false
      } catch (e) {
        toast.error(e.message)
      }
    }

    async function toggleConnect(node) {
      try {
        if (node.connected) {
          await nodes.disconnect(node.id)
          toast.info(`Disconnected ${node.name}`)
        } else {
          await nodes.connect(node.id)
          toast.info(`Connecting ${node.name}…`)
        }
      } catch (e) {
        toast.error(e.message)
      }
    }

    async function deleteNode() {
      if (!confirmDelete.value) return
      try {
        await nodes.remove(confirmDelete.value.id)
        toast.success('Node removed')
      } catch (e) {
        toast.error(e.message)
      }
      confirmDelete.value = null
    }

    return { nodes, showForm, editingNode, form, confirmDelete, openCreate, openEdit, save, toggleConnect, deleteNode }
  },
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-white">Nodes</h1>
        <button @click="openCreate" class="px-4 py-2 rounded-lg bg-mesh-600 hover:bg-mesh-500 text-white text-sm font-medium transition-colors">
          + Add Node
        </button>
      </div>

      <div v-if="nodes.loading" class="text-gray-500 text-sm">Loading…</div>
      <div v-else-if="!nodes.nodes.length" class="rounded-xl border border-dashed border-gray-700 p-12 text-center">
        <p class="text-gray-400 mb-2">No nodes configured</p>
        <p class="text-gray-600 text-sm">Add a node to connect to your MeshCore device.</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="node in nodes.nodes"
          :key="node.id"
          class="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4"
        >
          <div :class="['w-3 h-3 rounded-full flex-shrink-0', node.connected ? 'bg-green-500 shadow-lg shadow-green-900' : 'bg-gray-600']"></div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-white">{{ node.name }}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 uppercase">{{ node.connection_type }}</span>
            </div>
            <div class="text-xs text-gray-500 mt-0.5 font-mono">
              {{ node.connection_type === 'tcp' ? node.host + ':' + node.port : node.device_path }}
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              @click="toggleConnect(node)"
              :class="['px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', node.connected ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-mesh-900 text-mesh-400 hover:bg-mesh-800']"
            >
              {{ node.connected ? 'Disconnect' : 'Connect' }}
            </button>
            <router-link :to="\`/nodes/\${node.id}\`" class="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              Details
            </router-link>
            <button @click="openEdit(node)" class="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Edit</button>
            <button @click="confirmDelete = node" class="px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-900/30 transition-colors">Delete</button>
          </div>
        </div>
      </div>

      <!-- Node form modal -->
      <Modal :show="showForm" :title="editingNode ? 'Edit Node' : 'Add Node'" @close="showForm = false">
        <form @submit.prevent="save" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-300 mb-1.5">Display Name</label>
            <input v-model="form.name" type="text" required class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500" placeholder="My Node" />
          </div>

          <div>
            <label class="block text-sm text-gray-300 mb-1.5">Connection Type</label>
            <div class="flex gap-2">
              <button type="button" @click="form.connection_type = 'tcp'" :class="['flex-1 py-2 rounded-lg text-sm transition-colors', form.connection_type === 'tcp' ? 'bg-mesh-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700']">TCP</button>
              <button type="button" @click="form.connection_type = 'serial'" :class="['flex-1 py-2 rounded-lg text-sm transition-colors', form.connection_type === 'serial' ? 'bg-mesh-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700']">Serial / USB</button>
            </div>
          </div>

          <template v-if="form.connection_type === 'tcp'">
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2">
                <label class="block text-sm text-gray-300 mb-1.5">Host / IP</label>
                <input v-model="form.host" type="text" required class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500" placeholder="192.168.1.100" />
              </div>
              <div>
                <label class="block text-sm text-gray-300 mb-1.5">Port</label>
                <input v-model.number="form.port" type="number" required class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500" placeholder="4403" />
              </div>
            </div>
          </template>

          <template v-else>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-300 mb-1.5">Device Path</label>
                <input v-model="form.device_path" type="text" required class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500 font-mono" placeholder="/dev/ttyUSB0" />
              </div>
              <div>
                <label class="block text-sm text-gray-300 mb-1.5">Baud Rate</label>
                <input v-model.number="form.baud_rate" type="number" class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-mesh-500" placeholder="115200" />
              </div>
            </div>
          </template>

          <div class="flex items-center gap-3">
            <input v-model="form.enabled" type="checkbox" id="enabled" class="w-4 h-4 accent-mesh-500" />
            <label for="enabled" class="text-sm text-gray-300">Connect automatically on startup</label>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" @click="showForm = false" class="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 text-sm transition-colors">Cancel</button>
            <button type="submit" class="px-5 py-2 rounded-lg bg-mesh-600 hover:bg-mesh-500 text-white text-sm font-medium transition-colors">Save</button>
          </div>
        </form>
      </Modal>

      <!-- Delete confirm -->
      <ConfirmDialog
        :show="!!confirmDelete"
        title="Delete Node"
        :message="\`Remove \${confirmDelete?.name}? All associated data will be deleted.\`"
        confirm-label="Delete"
        :danger="true"
        @confirm="deleteNode"
        @cancel="confirmDelete = null"
      />
    </div>
  `,
})
