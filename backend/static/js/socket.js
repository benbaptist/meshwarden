/**
 * socket.js — Shared Socket.IO client singleton.
 * Connects with the JWT access token for server-side auth.
 */

import { useAuthStore } from './stores/auth.js'

let _socket = null

export function getSocket() {
  return _socket
}

export function connectSocket() {
  if (_socket) {
    if (!_socket.connected) _socket.connect()
    return _socket
  }

  _socket = io({
    // auth callback is re-evaluated on every (re)connect attempt,
    // so it always picks up the freshest access token.
    auth: (cb) => { cb({ token: useAuthStore().accessToken || '' }) },
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  })

  let refreshing = false
  _socket.on('connect_error', async (err) => {
    console.warn('[socket] connect_error:', err.message)
    // Server rejected our JWT (expired access token) — refresh it so the
    // next automatic reconnect attempt authenticates successfully.
    if (err.message === 'unauthorized' && !refreshing) {
      refreshing = true
      try { await useAuthStore().refresh() } finally { refreshing = false }
    }
  })

  return _socket
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}
