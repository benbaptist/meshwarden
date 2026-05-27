import { defineComponent, ref, onMounted } from 'vue'
import { useGroupsStore } from '../stores/groups.js'
import { useContactsStore } from '../stores/contacts.js'
import { useToast } from '../components/shared/Toast.js'

export default defineComponent({
  name: 'Groups',
  setup() {
    const groups = useGroupsStore()
    const contacts = useContactsStore()
    const toast = useToast()

    const showCreateForm = ref(false)
    const showDetail = ref(null)   // {group, members, automations}
    const confirmDeleteGroup = ref(null)
    const form = ref({ name: '', description: '', color: '#3B82F6' })
    const ruleForm = ref({ rule_type: 'telemetry', interval_seconds: 300, enabled: true })
    const showAddMember = ref(false)
    const selectedContactId = ref(null)
    const showRuleForm = ref(false)

    onMounted(async () => {
      await groups.fetchAll()
      if (!contacts.contacts.length) await contacts.fetchAll()
    })

    async function createGroup() {
      try {
        await groups.create(form.value)
        form.value = { name: '', description: '', color: '#3B82F6' }
        showCreateForm.value = false
        toast.success('Group created')
      } catch (e) {
        toast.error(e.message)
      }
    }

    async function openDetail(group) {
      const detail = await groups.fetchOne(group.id)
      const automations = await groups.fetchAutomations(group.id)
      showDetail.value = { ...detail, automations }
    }

    async function deleteGroup() {
      if (!confirmDeleteGroup.value) return
      try {
        await groups.remove(confirmDeleteGroup.value.id)
        toast.success('Group deleted')
        if (showDetail.value?.id === confirmDeleteGroup.value.id) showDetail.value = null
      } catch (e) {
        toast.error(e.message)
      }
      confirmDeleteGroup.value = null
    }

    async function addMember() {
      if (!selectedContactId.value || !showDetail.value) return
      try {
        await groups.addMember(showDetail.value.id, selectedContactId.value)
        await openDetail(showDetail.value)
        showAddMember.value = false
        selectedContactId.value = null
        toast.success('Member added')
      } catch (e) {
        toast.error(e.message)
      }
    }

    async function removeMember(contactId) {
      try {
        await groups.removeMember(showDetail.value.id, contactId)
        await openDetail(showDetail.value)
        toast.success('Member removed')
      } catch (e) {
        toast.error(e.message)
      }
    }

    async function createRule() {
      try {
        await groups.createAutomation(showDetail.value.id, ruleForm.value)
        await openDetail(showDetail.value)
        showRuleForm.value = false
        toast.success('Automation rule added')
      } catch (e) {
        toast.error(e.message)
      }
    }

    async function deleteRule(ruleId) {
      try {
        await groups.deleteAutomation(showDetail.value.id, ruleId)
        await openDetail(showDetail.value)
        toast.success('Rule deleted')
      } catch (e) {
        toast.error(e.message)
      }
    }

    const nonMembers = () => {
      if (!showDetail.value) return contacts.contacts
      const memberIds = new Set(showDetail.value.members.map((m) => m.id))
      return contacts.contacts.filter((c) => !memberIds.has(c.id))
    }

    return {
      groups, contacts, showCreateForm, showDetail, confirmDeleteGroup, form,
      ruleForm, showAddMember, selectedContactId, showRuleForm,
      createGroup, openDetail, deleteGroup, addMember, removeMember,
      createRule, deleteRule, nonMembers,
    }
  },
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="px-4 pt-6 pb-4 flex items-center justify-between flex-shrink-0">
        <h1 class="text-2xl font-bold text-white">Groups</h1>
        <button @click="showCreateForm = true" class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-mesh-600 hover:bg-mesh-500 text-white text-sm font-semibold transition-colors active:scale-95">
          <Icon name="plus" :size="16" /> Create
        </button>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto px-4 pb-6">
        <div v-if="groups.loading" class="py-16 text-center text-zinc-600 text-sm">Loading…</div>
        <div v-else-if="!groups.groups.length" class="mt-4 rounded-2xl border border-dashed border-white/[0.1] p-12 text-center">
          <p class="text-zinc-400 mb-1 text-sm">No groups yet</p>
          <p class="text-zinc-600 text-xs">Groups let you tag contacts and run automated telemetry polls.</p>
        </div>
        <div v-else class="space-y-3">
          <button
            v-for="group in groups.groups"
            :key="group.id"
            class="w-full glass rounded-2xl px-4 py-4 flex items-center gap-3 hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors text-left"
            @click="openDetail(group)"
          >
            <div class="w-3.5 h-3.5 rounded-full flex-shrink-0" :style="{ background: group.color }"></div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-white">{{ group.name }}</div>
              <div class="text-xs text-zinc-500 mt-0.5">{{ group.member_count }} member{{ group.member_count !== 1 ? 's' : '' }}</div>
            </div>
            <Icon name="arrow-right" :size="16" class="text-zinc-700 flex-shrink-0" />
          </button>
        </div>
      </div>

      <!-- Create group modal -->
      <Modal :show="showCreateForm" title="Create Group" @close="showCreateForm = false">
        <form @submit.prevent="createGroup" class="space-y-4">
          <div>
            <label class="block text-xs text-zinc-500 mb-1.5">Name</label>
            <input v-model="form.name" type="text" required
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);" />
          </div>
          <div>
            <label class="block text-xs text-zinc-500 mb-1.5">Description</label>
            <input v-model="form.description" type="text"
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);" />
          </div>
          <div>
            <label class="block text-xs text-zinc-500 mb-1.5">Color</label>
            <input v-model="form.color" type="color" class="h-9 w-full rounded-xl cursor-pointer" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);" />
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" @click="showCreateForm = false" class="px-4 py-2 rounded-xl text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.05] transition-all">Cancel</button>
            <button type="submit" class="px-5 py-2 rounded-lg bg-mesh-600 hover:bg-mesh-500 text-white text-sm font-medium transition-colors">Create</button>
          </div>
        </form>
      </Modal>

      <!-- Group detail modal -->
      <Modal :show="!!showDetail" :title="showDetail?.name || ''" max-width="max-w-2xl" @close="showDetail = null">
        <template v-if="showDetail">
          <!-- Members -->
          <div class="mb-5">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Members</h3>
              <button @click="showAddMember = true" class="text-xs text-mesh-400 hover:text-mesh-300">+ Add</button>
            </div>
            <div v-if="!showDetail.members?.length" class="text-sm text-zinc-600">No members yet</div>
            <div v-else class="space-y-2">
              <div v-for="m in showDetail.members" :key="m.id" class="flex items-center gap-3 rounded-xl px-3 py-2" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06);">
                <div class="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center text-xs font-bold text-zinc-300">
                  {{ (m.adv_name || '?')[0].toUpperCase() }}
                </div>
                <span class="text-sm text-white flex-1">{{ m.adv_name || m.public_key.slice(0,12) }}</span>
                <button @click="removeMember(m.id)" class="text-xs text-zinc-500 hover:text-red-400 transition-colors">Remove</button>
              </div>
            </div>
          </div>

          <!-- Automations -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Automation Rules</h3>
              <button @click="showRuleForm = true" class="text-xs text-mesh-400 hover:text-mesh-300">+ Add Rule</button>
            </div>
            <div v-if="!showDetail.automations?.length" class="text-sm text-zinc-600">No rules configured</div>
            <div v-else class="space-y-2">
              <div v-for="rule in showDetail.automations" :key="rule.id" class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06);">
                <span :class="['w-2 h-2 rounded-full flex-shrink-0', rule.enabled ? 'bg-green-500' : 'bg-zinc-600']"></span>
                <span class="text-white capitalize">{{ rule.rule_type }}</span>
                <span class="text-zinc-500">every {{ rule.interval_seconds >= 3600 ? (rule.interval_seconds/3600)+'h' : (rule.interval_seconds/60)+'m' }}</span>
                <span v-if="rule.last_run" class="text-zinc-600 text-xs">last: {{ new Date(rule.last_run).toLocaleTimeString() }}</span>
                <button @click="deleteRule(rule.id)" class="ml-auto text-xs text-zinc-500 hover:text-red-400">Delete</button>
              </div>
            </div>
          </div>

          <div class="mt-5 pt-4 border-t border-white/[0.06] flex justify-end">
            <button @click="confirmDeleteGroup = showDetail; showDetail = null" class="text-xs text-red-500 hover:text-red-400 transition-colors">Delete Group</button>
          </div>
        </template>
      </Modal>

      <!-- Add member modal -->
      <Modal :show="showAddMember" title="Add Member" @close="showAddMember = false">
        <div class="space-y-3">
          <select v-model="selectedContactId"
            class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 outline-none"
            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);">
            <option :value="null">Select a contact…</option>
            <option v-for="c in nonMembers()" :key="c.id" :value="c.id">{{ c.adv_name || c.public_key.slice(0,12) }}</option>
          </select>
          <div class="flex justify-end gap-3">
            <button @click="showAddMember = false" class="px-4 py-2 rounded-xl text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.05] transition-all">Cancel</button>
            <button @click="addMember" :disabled="!selectedContactId" class="px-5 py-2 rounded-lg bg-mesh-600 hover:bg-mesh-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">Add</button>
          </div>
        </div>
      </Modal>

      <!-- Add rule modal -->
      <Modal :show="showRuleForm" title="Add Automation Rule" @close="showRuleForm = false">
        <form @submit.prevent="createRule" class="space-y-4">
          <div>
            <label class="block text-xs text-zinc-500 mb-1.5">Rule Type</label>
            <div class="flex gap-2">
              <button type="button" @click="ruleForm.rule_type = 'telemetry'" :class="['flex-1 py-2 rounded-lg text-sm transition-colors', ruleForm.rule_type === 'telemetry' ? 'bg-mesh-700 text-white' : 'bg-white/[0.05] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.08]']">Telemetry Poll</button>
              <button type="button" @click="ruleForm.rule_type = 'status'" :class="['flex-1 py-2 rounded-lg text-sm transition-colors', ruleForm.rule_type === 'status' ? 'bg-mesh-700 text-white' : 'bg-white/[0.05] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.08]']">Status Poll</button>
            </div>
          </div>
          <div>
            <label class="block text-xs text-zinc-500 mb-1.5">Interval (seconds, min 60)</label>
            <input v-model.number="ruleForm.interval_seconds" type="number" min="60" required
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);" />
          </div>
          <div class="flex items-center gap-3">
            <input v-model="ruleForm.enabled" type="checkbox" id="rule-enabled" class="w-4 h-4 accent-mesh-500" />
            <label for="rule-enabled" class="text-sm text-zinc-400">Enabled</label>
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" @click="showRuleForm = false" class="px-4 py-2 rounded-xl text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.05] transition-all">Cancel</button>
            <button type="submit" class="px-5 py-2 rounded-lg bg-mesh-600 hover:bg-mesh-500 text-white text-sm font-medium transition-colors">Create Rule</button>
          </div>
        </form>
      </Modal>

      <!-- Delete group confirm -->
      <ConfirmDialog
        :show="!!confirmDeleteGroup"
        title="Delete Group"
        :message="\`Delete '\${confirmDeleteGroup?.name}'? Members and rules will be removed.\`"
        confirm-label="Delete"
        :danger="true"
        @confirm="deleteGroup"
        @cancel="confirmDeleteGroup = null"
      />
    </div>
  `,
})
