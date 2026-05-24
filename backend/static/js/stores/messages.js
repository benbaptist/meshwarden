import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api.js'
import { getSocket } from '../socket.js'

export const useMessagesStore = defineStore('messages', () => {
  // keyed by conversation key: `direct-${contact_id}` or `channel-${node_id}-${channel_idx}`
  const threads = ref({})
  const unreadCounts = ref({})

  function threadKey(msg) {
    if (msg.msg_type === 'direct') return `direct-${msg.contact_id}`
    return `channel-${msg.node_id}-${msg.channel_idx}`
  }

  function _addToThread(msg) {
    const key = threadKey(msg)
    if (!threads.value[key]) threads.value[key] = []
    const exists = threads.value[key].find((m) => m.id === msg.id)
    if (!exists) {
      threads.value[key].unshift(msg)  // newest first
    }
  }

  async function fetchThread(key, params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    const msgs = await api.json(`/api/messages/?${qs}`)
    threads.value[key] = msgs
    return msgs
  }

  async function send(data) {
    const msg = await api.json('/api/messages/', { method: 'POST', body: JSON.stringify(data) })
    _addToThread(msg)
    return msg
  }

  function bindSocket(activeKey = null) {
    const socket = getSocket()
    if (!socket) return

    socket.on('message:received', ({ message }) => {
      _addToThread(message)
      const key = threadKey(message)
      if (key !== activeKey) {
        unreadCounts.value[key] = (unreadCounts.value[key] || 0) + 1
      }
    })

    socket.on('message:ack', ({ message_id, status }) => {
      for (const thread of Object.values(threads.value)) {
        const msg = thread.find((m) => m.id === message_id)
        if (msg) { msg.status = status; break }
      }
    })
  }

  function clearUnread(key) {
    unreadCounts.value[key] = 0
  }

  return {
    threads, unreadCounts,
    fetchThread, send, bindSocket, clearUnread,
  }
})
