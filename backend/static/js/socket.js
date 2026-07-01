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
  if (_socket && _socket.connected) return _socket

  const auth = useAuthStore()
  _socket = io({
    auth: (cb) => { cb({ token: useAuthStore().accessToken || '' }) },
    transports: ['polling'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  })

  _socket.on('connect_error', (err) => {
    console.warn('[socket] connect_error:', err.message)
  })

  return _socket
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}
