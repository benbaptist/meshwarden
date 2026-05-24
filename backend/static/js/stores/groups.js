import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api.js'

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      groups.value = await api.json('/api/groups/')
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id) {
    return api.json(`/api/groups/${id}`)
  }

  async function create(data) {
    const group = await api.json('/api/groups/', { method: 'POST', body: JSON.stringify(data) })
    groups.value.push(group)
    return group
  }

  async function update(id, data) {
    const group = await api.json(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    const idx = groups.value.findIndex((g) => g.id === id)
    if (idx !== -1) groups.value[idx] = group
    return group
  }

  async function remove(id) {
    await api.json(`/api/groups/${id}`, { method: 'DELETE' })
    groups.value = groups.value.filter((g) => g.id !== id)
  }

  async function addMember(groupId, contactId) {
    return api.json(`/api/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ contact_id: contactId }),
    })
  }

  async function removeMember(groupId, contactId) {
    return api.json(`/api/groups/${groupId}/members/${contactId}`, { method: 'DELETE' })
  }

  async function fetchAutomations(groupId) {
    return api.json(`/api/groups/${groupId}/automations`)
  }

  async function createAutomation(groupId, data) {
    return api.json(`/api/groups/${groupId}/automations`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async function updateAutomation(groupId, ruleId, data) {
    return api.json(`/api/groups/${groupId}/automations/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async function deleteAutomation(groupId, ruleId) {
    return api.json(`/api/groups/${groupId}/automations/${ruleId}`, { method: 'DELETE' })
  }

  return {
    groups, loading,
    fetchAll, fetchOne, create, update, remove,
    addMember, removeMember,
    fetchAutomations, createAutomation, updateAutomation, deleteAutomation,
  }
})
