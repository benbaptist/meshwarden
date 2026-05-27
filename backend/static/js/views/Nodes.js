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
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="px-4 pt-6 pb-4 flex items-center justify-between flex-shrink-0">
        <h1 class="text-2xl font-bold text-white">Nodes</h1>
        <button @click="openCreate" class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-mesh-600 hover:bg-mesh-500 text-white text-sm font-semibold transition-colors active:scale-95">
          <Icon name="plus" :size="16" /> Add Node
        </button>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        <div v-if="nodes.loading" class="py-16 text-center text-zinc-600 text-sm">Loading…</div>
        <div v-else-if="!nodes.nodes.length" class="mt-8 rounded-2xl border border-dashed border-white/[0.1] p-12 text-center">
          <p class="text-zinc-400 mb-1">No nodes configured</p>
          <p class="text-zinc-600 text-sm">Add a node to connect to your MeshCore device.</p>
        </div>

        <div
          v-for="node in nodes.nodes"
          :key="node.id"
          class="glass rounded-2xl overflow-hidden"
        >
          <!-- Node info -->
          <div class="px-4 py-4 flex items-start gap-3">
            <div class="mt-1.5 flex-shrink-0">
              <div :class="['w-2.5 h-2.5 rounded-full', node.connected ? 'bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.4)]' : 'bg-zinc-600']"></div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-white">{{ node.name }}</span>
                <span class="text-xs px-1.5 py-0.5 rounded-md bg-white/[0.06] text-zinc-500 uppercase tracking-wide">{{ node.connection_type }}</span>
              </div>
              <div class="text-xs text-gray-500 mt-0.5 font-mono truncate">
                {{ node.connection_type === 'tcp' ? node.host + ':' + node.port : node.device_path }}
              </div>
              <div class="text-xs mt-1" :class="node.connected ? 'text-green-500' : 'text-gray-600'">
                {{ node.connected ? 'Connected' : 'Disconnected' }}
              </div>
            </div>
          </div>

          <!-- Action row — full-width tap-friendly buttons -->
          <div class="border-t border-white/[0.06] grid grid-cols-4 divide-x divide-white/[0.06]">
            <button
              @click="toggleConnect(node)"
              class="py-3.5 text-xs font-semibold text-center transition-colors active:opacity-70"
              :class="node.connected ? 'text-orange-400 hover:bg-orange-900/20' : 'text-mesh-400 hover:bg-mesh-900/20'"
            >
              {{ node.connected ? 'Disconnect' : 'Connect' }}
            </button>
            <router-link
              :to="\`/nodes/\${node.id}\`"
              class="py-3.5 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors text-center flex items-center justify-center"
            >
              Details
            </router-link>
            <button
              @click="openEdit(node)"
              class="py-3.5 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Edit
            </button>
            <button
              @click="confirmDelete = node"
              class="py-3.5 text-xs text-red-500 hover:bg-red-900/20 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Node form modal -->
      <Modal :show="showForm" :title="editingNode ? 'Edit Node' : 'Add Node'" @close="showForm = false">
        <form @submit.prevent="save" class="space-y-4">
          <div>
            <label class="block text-xs text-zinc-500 mb-1.5">Display Name</label>
            <input v-model="form.name" type="text" required
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
              placeholder="My Node" />
          </div>

          <div>
            <label class="block text-xs text-zinc-500 mb-1.5">Connection Type</label>
            <div class="flex gap-2">
              <button type="button" @click="form.connection_type = 'tcp'" :class="['flex-1 py-2.5 rounded-lg text-sm transition-colors', form.connection_type === 'tcp' ? 'bg-mesh-700 text-white' : 'bg-white/[0.05] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.08]']">TCP</button>
              <button type="button" @click="form.connection_type = 'serial'" :class="['flex-1 py-2.5 rounded-lg text-sm transition-colors', form.connection_type === 'serial' ? 'bg-mesh-700 text-white' : 'bg-white/[0.05] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.08]']">Serial / USB</button>
            </div>
          </div>

          <template v-if="form.connection_type === 'tcp'">
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2">
                <label class="block text-xs text-zinc-500 mb-1.5">Host / IP</label>
                <input v-model="form.host" type="text" required
                  class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
                  placeholder="192.168.1.100" />
              </div>
              <div>
                <label class="block text-xs text-zinc-500 mb-1.5">Port</label>
                <input v-model.number="form.port" type="number" required
                  class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
                  placeholder="4403" />
              </div>
            </div>
          </template>

          <template v-else>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-zinc-500 mb-1.5">Device Path</label>
                <input v-model="form.device_path" type="text" required
                  class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none font-mono"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
                  placeholder="/dev/ttyUSB0" />
              </div>
              <div>
                <label class="block text-xs text-zinc-500 mb-1.5">Baud Rate</label>
                <input v-model.number="form.baud_rate" type="number"
                  class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
                  placeholder="115200" />
              </div>
            </div>
          </template>

          <div class="flex items-center gap-3">
            <input v-model="form.enabled" type="checkbox" id="enabled" class="w-4 h-4 accent-mesh-500" />
            <label for="enabled" class="text-sm text-zinc-400">Connect automatically on startup</label>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" @click="showForm = false" class="px-4 py-2.5 rounded-xl text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.05] transition-all">Cancel</button>
            <button type="submit" class="px-5 py-2.5 rounded-lg bg-mesh-600 hover:bg-mesh-500 text-white text-sm font-medium transition-colors">Save</button>
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
