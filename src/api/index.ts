import type { Source, SyncTask, SSHKey, SyncLog } from '@/types'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

// Sources
export const sourcesApi = {
  list: () => request<Source[]>('/sources'),
  create: (data: Partial<Source>) => request<Source>('/sources', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Source>) => request<Source>(`/sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/sources/${id}`, { method: 'DELETE' }),
}

// Tasks
export const tasksApi = {
  list: () => request<SyncTask[]>('/tasks'),
  create: (data: Partial<SyncTask>) => request<SyncTask>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SyncTask>) => request<SyncTask>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  sync: (id: string) => request<{ message: string }>(`/tasks/${id}/sync`, { method: 'POST' }),
  logs: (id: string) => request<SyncLog[]>(`/tasks/${id}/logs`),
}

// SSH Keys
export const sshKeysApi = {
  list: () => request<SSHKey[]>('/ssh-keys'),
  create: (data: { name: string; privateKey?: string; publicKey?: string; generate?: boolean }) =>
    request<SSHKey>('/ssh-keys', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/ssh-keys/${id}`, { method: 'DELETE' }),
  getPublicKey: (id: string) => request<{ publicKey: string }>(`/ssh-keys/${id}/public`),
}
