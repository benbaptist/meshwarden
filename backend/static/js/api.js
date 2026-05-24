/**
 * api.js — Fetch wrapper with automatic JWT access-token injection and
 * silent token refresh on 401.
 */

import { useAuthStore } from './stores/auth.js'

const BASE = ''  // same origin

async function _refreshToken() {
  const resp = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',  // sends the httpOnly refresh cookie
  })
  if (!resp.ok) return false
  const data = await resp.json()
  const auth = useAuthStore()
  auth.setAccessToken(data.access_token)
  return true
}

async function request(path, options = {}) {
  const auth = useAuthStore()
  const headers = { 'Content-Type': 'application/json', ...options.headers }

  if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`
  }

  let resp = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  // Silent refresh on 401
  if (resp.status === 401 && auth.accessToken) {
    const refreshed = await _refreshToken()
    if (refreshed) {
      const auth2 = useAuthStore()
      headers['Authorization'] = `Bearer ${auth2.accessToken}`
      resp = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' })
    } else {
      auth.logout()
      return resp
    }
  }

  return resp
}

const api = {
  get: (path, opts = {}) => request(path, { method: 'GET', ...opts }),
  post: (path, body, opts = {}) =>
    request(path, { method: 'POST', body: JSON.stringify(body), ...opts }),
  put: (path, body, opts = {}) =>
    request(path, { method: 'PUT', body: JSON.stringify(body), ...opts }),
  delete: (path, opts = {}) => request(path, { method: 'DELETE', ...opts }),

  /** Convenience: parse JSON or throw with error message */
  async json(path, options = {}) {
    const resp = await request(path, options)
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
    return data
  },
}

export default api
