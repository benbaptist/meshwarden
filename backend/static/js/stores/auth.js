import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api.js'
import { connectSocket, disconnectSocket } from '../socket.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const accessToken = ref(localStorage.getItem('mw_access_token'))
  const setupComplete = ref(false)
  const setupChecked = ref(false)

  const isAuthenticated = computed(() => !!accessToken.value)

  function setAccessToken(token) {
    accessToken.value = token
    if (token) {
      localStorage.setItem('mw_access_token', token)
    } else {
      localStorage.removeItem('mw_access_token')
    }
  }

  async function checkSetup() {
    try {
      const data = await api.json('/api/auth/status')
      setupComplete.value = data.setup_complete
    } catch {
      setupComplete.value = false
    } finally {
      setupChecked.value = true
    }
  }

  async function setup(username, password) {
    const data = await api.json('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setAccessToken(data.access_token)
    user.value = data.user
    setupComplete.value = true
    connectSocket()
    return data
  }

  async function login(username, password) {
    const data = await api.json('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setAccessToken(data.access_token)
    user.value = data.user
    connectSocket()
    return data
  }

  async function refresh() {
    try {
      const resp = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      if (!resp.ok) { logout(); return false }
      const data = await resp.json()
      setAccessToken(data.access_token)
      user.value = data.user
      return true
    } catch {
      logout()
      return false
    }
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout', {})
    } catch { /* best effort */ }
    setAccessToken(null)
    user.value = null
    disconnectSocket()
  }

  // Try to restore session from stored token on page load
  async function restoreSession() {
    if (!accessToken.value) return false
    try {
      const data = await api.json('/api/auth/refresh')
      setAccessToken(data.access_token)
      user.value = data.user
      connectSocket()
      return true
    } catch {
      setAccessToken(null)
      return false
    }
  }

  async function changePassword(currentPassword, newPassword) {
    await api.json('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
    // All sessions revoked — force logout
    setAccessToken(null)
    user.value = null
    disconnectSocket()
  }

  return {
    user, accessToken, setupComplete, setupChecked, isAuthenticated,
    setAccessToken, checkSetup, setup, login, refresh, logout, restoreSession, changePassword,
  }
})
