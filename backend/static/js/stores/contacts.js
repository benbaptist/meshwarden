import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api.js'
import { getSocket } from '../socket.js'

export const useContactsStore = defineStore('contacts', () => {
  const contacts = ref([])
  const loading = ref(false)

  async function fetchAll(params = {}) {
    loading.value = true
    try {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      )
      contacts.value = await api.json(`/api/contacts/?${qs}`)
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id) {
    return api.json(`/api/contacts/${id}`)
  }

  async function update(id, data) {
    const contact = await api.json(`/api/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    const idx = contacts.value.findIndex((c) => c.id === id)
    if (idx !== -1) contacts.value[idx] = contact
    return contact
  }

  async function fetchHistory(id, page = 1) {
    return api.json(`/api/contacts/${id}/history?page=${page}`)
  }

  async function fetchTelemetry(id, params = {}) {
    const qs = new URLSearchParams(params)
    return api.json(`/api/contacts/${id}/telemetry?${qs}`)
  }

  async function fetchMessages(id, page = 1) {
    return api.json(`/api/contacts/${id}/messages?page=${page}`)
  }

  async function fetchSignal(id) {
    return api.json(`/api/contacts/${id}/signal`)
  }

  async function requestTelemetry(id) {
    return api.json(`/api/contacts/${id}/telemetry_req`, { method: 'POST' })
  }

  function bindSocket() {
    const socket = getSocket()
    if (!socket) return

    socket.on('contact:new', ({ contact }) => {
      if (!contacts.value.find((c) => c.id === contact.id)) {
        contacts.value.unshift(contact)
      }
    })

    socket.on('contact:updated', ({ contact }) => {
      const idx = contacts.value.findIndex((c) => c.id === contact.id)
      if (idx !== -1) contacts.value[idx] = { ...contacts.value[idx], ...contact }
    })
  }

  return {
    contacts, loading,
    fetchAll, fetchOne, update, fetchHistory, fetchTelemetry,
    fetchMessages, fetchSignal, requestTelemetry, bindSocket,
  }
})
