import { defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNodesStore } from '../../stores/nodes.js'

export default defineComponent({
  name: 'NodeSwitcher',
  props: {
    compact: { type: Boolean, default: false },
  },
  setup(props) {
    const nodes = useNodesStore()
    const router = useRouter()
    const open = ref(false)

    function select(id) {
      nodes.setActive(id)
      open.value = false
    }

    function goToSettings() {
      open.value = false
      router.push('/settings')
    }

    return { nodes, open, select, goToSettings }
  },
  template: `
    <div class="relative">
      <!-- Trigger button -->
      <button
        @click="open = !open"
        :class="[
          'flex items-center gap-2 transition-all rounded-xl',
          compact
            ? 'px-2.5 py-1.5 text-xs'
            : 'w-full px-3 py-2 text-sm',
        ]"
        style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);"
      >
        <div
          :class="['w-2 h-2 rounded-full flex-shrink-0 transition-shadow', nodes.activeNode?.connected
            ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]'
            : 'bg-zinc-600']"
        ></div>
        <span class="text-white font-medium truncate flex-1 text-left min-w-0">
          {{ nodes.activeNode ? nodes.activeNode.name : 'No node selected' }}
        </span>
        <Icon name="chevron-down" :size="compact ? 11 : 13" class="text-zinc-500 flex-shrink-0" />
      </button>

      <!-- Dropdown panel -->
      <div
        v-if="open"
        class="absolute z-[1000] min-w-[200px] py-1.5 rounded-2xl shadow-2xl"
        :class="compact ? 'right-0 top-full mt-1.5' : 'left-0 top-full mt-1.5'"
        style="background: #17172a; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 16px 48px rgba(0,0,0,0.5);"
      >
        <div v-if="!nodes.nodes.length" class="px-4 py-4 text-center">
          <div class="text-xs text-zinc-500 mb-2">No nodes configured yet.</div>
          <button @click="goToSettings" class="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            Add a node in Settings
          </button>
        </div>

        <template v-else>
          <div class="px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Switch Node</div>
          <button
            v-for="node in nodes.nodes"
            :key="node.id"
            @click="select(node.id)"
            class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
            :class="node.id === nodes.activeNodeId ? 'text-violet-300' : 'text-zinc-300'"
          >
            <div :class="['w-2 h-2 rounded-full flex-shrink-0', node.connected ? 'bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.6)]' : 'bg-zinc-600']"></div>
            <span class="text-sm font-medium flex-1 truncate">{{ node.name }}</span>
            <span v-if="!node.connected" class="text-[10px] text-zinc-600">offline</span>
            <Icon v-if="node.id === nodes.activeNodeId" name="check" :size="13" class="text-violet-400 flex-shrink-0" />
          </button>
        </template>

        <div class="border-t border-white/[0.06] mt-1 pt-1">
          <button
            @click="goToSettings"
            class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
          >
            <Icon name="cog" :size="13" />
            Manage nodes
          </button>
        </div>
      </div>

      <!-- Backdrop to close dropdown -->
      <div v-if="open" class="fixed inset-0 z-[999]" @click="open = false"></div>
    </div>
  `,
})
