import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api.js'
import { getSocket } from '../socket.js'

export const useNodesStore = defineStore('nodes', () => {
  const nodes = ref([])
  const loading = ref(false)
  const activeNodeId = ref(
    localStorage.getItem('mw_activeNode') ? Number(localStorage.getItem('mw_activeNode')) : null
  )

  const activeNode = computed(() => nodes.value.find((n) => n.id === activeNodeId.value) ?? null)

  function setActive(id) {
    activeNodeId.value = id
    if (id != null) localStorage.setItem('mw_activeNode', String(id))
    else localStorage.removeItem('mw_activeNode')
  }

  async function fetchAll() {
    loading.value = true
    try {
      nodes.value = await api.json('/api/nodes/')
      // Auto-select: prefer stored id, else first connected, else first available
      const stored = activeNodeId.value
      if (!stored || !nodes.value.find((n) => n.id === stored)) {
        const connected = nodes.value.find((n) => n.connected)
        setActive(connected ? connected.id : (nodes.value[0]?.id ?? null))
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id) {
    return api.json(`/api/nodes/${id}`)
  }

  async function create(data) {
    const node = await api.json('/api/nodes/', { method: 'POST', body: JSON.stringify(data) })
    nodes.value.push(node)
    return node
  }

  async function update(id, data) {
    const node = await api.json(`/api/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    const idx = nodes.value.findIndex((n) => n.id === id)
    if (idx !== -1) nodes.value[idx] = node
    return node
  }

  async function remove(id) {
    await api.json(`/api/nodes/${id}`, { method: 'DELETE' })
    nodes.value = nodes.value.filter((n) => n.id !== id)
    if (activeNodeId.value === id) {
      setActive(nodes.value[0]?.id ?? null)
    }
  }

  async function connect(id) {
    await api.json(`/api/nodes/${id}/connect`, { method: 'POST' })
  }

  async function disconnect(id) {
    await api.json(`/api/nodes/${id}/disconnect`, { method: 'POST' })
  }

  async function sync(id) {
    await api.json(`/api/nodes/${id}/sync`, { method: 'POST' })
  }

  async function fetchStats(id) {
    return api.json(`/api/nodes/${id}/stats`)
  }

  async function pushConfig(id, config) {
    return api.json(`/api/nodes/${id}/config`, { method: 'PUT', body: JSON.stringify(config) })
  }

  // React to real-time events
  function bindSocket() {
    const socket = getSocket()
    if (!socket) return

    socket.on('node:connection', ({ node_id, connected }) => {
      const node = nodes.value.find((n) => n.id === node_id)
      if (node) node.connected = connected
    })

    socket.on('node:self_info', ({ node_id, self_info }) => {
      const node = nodes.value.find((n) => n.id === node_id)
      if (node) node.self_info = self_info
    })

    socket.on('nodes:status_snapshot', (statuses) => {
      for (const [id, connected] of Object.entries(statuses)) {
        const node = nodes.value.find((n) => n.id === Number(id))
        if (node) node.connected = connected
      }
    })
  }

  return {
    nodes, loading, activeNodeId, activeNode,
    setActive, fetchAll, fetchOne, create, update, remove,
    connect, disconnect, sync, fetchStats, pushConfig, bindSocket,
  }
})
