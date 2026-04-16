export type Platform = 'github' | 'gitlab' | 'gitea' | 'custom'
export type AuthType = 'https' | 'ssh'
export type TaskStatus = 'idle' | 'running' | 'success' | 'failed'

export interface Source {
  id: string
  name: string
  platform: Platform
  baseUrl: string
  authType: AuthType
  httpsToken?: string
  sshKeyId?: string
  proxy?: string
  createdAt: string
}

export interface RepoEndpoint {
  sourceId?: string
  repoUrl: string
  authType: AuthType
}

export interface SyncTask {
  id: string
  name: string
  sourceRepo: RepoEndpoint
  targetRepo: RepoEndpoint
  schedule: {
    enabled: boolean
    cron: string
  }
  status: TaskStatus
  lastSyncAt?: string
  lastError?: string
  createdAt: string
}

export interface SSHKey {
  id: string
  name: string
  privateKeyPath: string
  publicKey: string
  createdAt: string
}

export interface SyncLog {
  taskId: string
  timestamp: string
  success: boolean
  message: string
  duration: number
}
