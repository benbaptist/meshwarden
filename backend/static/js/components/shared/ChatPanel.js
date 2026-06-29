import { defineComponent, ref, computed, nextTick, onMounted, watch } from 'vue'

export default defineComponent({
  name: 'ChatPanel',
  props: {
    thread:   { type: Array,   required: true },
    sending:  { type: Boolean, default: false },
    // When focused changes to true (e.g. tab switch), scroll to bottom
    focused:  { type: Boolean, default: true },
  },
  emits: ['send', 'sender-click'],
  setup(props, { emit }) {
    const text = ref('')
    const threadRef = ref(null)

    const sortedThread = computed(() => [...props.thread].reverse())

    function scrollToBottom() {
      if (threadRef.value) threadRef.value.scrollTop = threadRef.value.scrollHeight
    }

    function send() {
      const trimmed = text.value.trim()
      if (!trimmed || props.sending) return
      emit('send', trimmed)
      text.value = ''
      nextTick(scrollToBottom)
    }

    function onKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
    }

    watch(() => props.thread.length, () => nextTick(scrollToBottom))
    watch(() => props.focused, (v) => { if (v) nextTick(scrollToBottom) })

    onMounted(() => nextTick(scrollToBottom))

    function parseChanMsg(text) {
      const sep = text.indexOf(': ')
      if (sep > 0 && sep < 50) return { sender: text.slice(0, sep), body: text.slice(sep + 2) }
      return { sender: null, body: text }
    }

    function fmtTimestamp(ts) {
      const d = new Date(ts)
      const now = new Date()
      const today = now.toDateString() === d.toDateString()
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      if (today) return time
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
      if (yesterday.toDateString() === d.toDateString()) return `Yesterday ${time}`
      const withinYear = d.getFullYear() === now.getFullYear()
      const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(withinYear ? {} : { year: 'numeric' }) })
      return `${date} ${time}`
    }

    return { text, threadRef, sortedThread, send, onKeydown, parseChanMsg, fmtTimestamp }
  },
  template: `
    <div class="flex flex-col flex-1 min-h-0">
      <!-- Thread -->
      <div ref="threadRef" class="flex-1 overflow-y-auto scrollbar-none px-4 py-4 space-y-2.5">
        <div v-if="!sortedThread.length" class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="text-zinc-600 text-sm">No messages yet</div>
            <div class="text-zinc-700 text-xs mt-1">Send the first message below</div>
          </div>
        </div>
        <div
          v-for="msg in sortedThread"
          :key="msg.id"
          :class="['flex', msg.direction === 'out' ? 'justify-end' : 'justify-start']"
        >
          <div
            :class="['max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed', msg.direction === 'out' ? 'rounded-br-md' : 'rounded-bl-md glass']"
            :style="msg.direction === 'out' ? 'background: linear-gradient(135deg, #7c3aed, #9333ea); color: white;' : 'color: #e4e4e7;'"
          >
            <button
              v-if="msg.direction === 'in' && msg.msg_type === 'channel' && parseChanMsg(msg.text).sender"
              @click="$emit('sender-click', parseChanMsg(msg.text).sender)"
              class="text-[11px] font-medium text-violet-300/70 mb-0.5 hover:text-violet-200 hover:underline cursor-pointer block transition-colors"
            >{{ parseChanMsg(msg.text).sender }}</button>
            <div>{{ msg.direction === 'in' && msg.msg_type === 'channel' ? parseChanMsg(msg.text).body : msg.text }}</div>
            <div class="flex items-center gap-1.5 mt-1" :class="msg.direction === 'out' ? 'justify-end' : 'justify-start'">
              <span class="text-[10px] opacity-60">{{ fmtTimestamp(msg.timestamp) }}</span>
              <!-- Outbound direct message: show delivery status -->
              <template v-if="msg.direction === 'out' && msg.msg_type !== 'channel'">
                <span class="inline-flex items-center" :title="msg.status === 'acked' ? 'Acknowledged by recipient' : msg.status === 'sent' ? 'Delivered to mesh' : msg.status === 'failed' ? 'Send failed' : 'Queued for transmission'">
                  <Icon v-if="msg.status === 'failed'" name="x-circle" :size="11" class="text-rose-400" />
                  <template v-else-if="msg.status === 'acked'">
                    <!-- Double-check: acked by recipient -->
                    <svg width="18" height="11" viewBox="0 0 18 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-violet-400" aria-hidden="true">
                      <polyline points="1,6 5,10 11,2" />
                      <polyline points="7,6 11,10 17,2" />
                    </svg>
                  </template>
                  <Icon v-else-if="msg.status === 'sent'" name="check" :size="11" class="opacity-50" title="Delivered to mesh" />
                  <Icon v-else name="clock" :size="11" class="opacity-40" />
                </span>
              </template>
              <!-- Inbound channel message: show hop count if available -->
              <template v-if="msg.direction === 'in' && msg.msg_type === 'channel' && msg.hop_count != null">
                <span class="text-[10px] opacity-40" :title="'Repeated ' + msg.hop_count + (msg.hop_count !== 1 ? ' times' : ' time')">×{{ msg.hop_count }}</span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Compose -->
      <div
        class="flex-shrink-0 px-4 py-3 border-t border-white/[0.06] flex gap-2 items-end"
        style="background: rgba(9,9,15,0.5); backdrop-filter: blur(12px);"
      >
        <textarea
          v-model="text"
          @keydown="onKeydown"
          placeholder="Message…"
          rows="1"
          class="flex-1 resize-none px-3.5 py-2.5 rounded-2xl text-sm text-zinc-100 placeholder-zinc-600 outline-none max-h-32 overflow-y-auto"
          style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);"
        ></textarea>
        <button
          @click="send"
          :disabled="!text.trim() || sending"
          class="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40"
          style="background: linear-gradient(135deg, #7c3aed, #9333ea);"
        >
          <Icon name="send" :size="16" class="text-white" />
        </button>
      </div>
    </div>
  `,
})
