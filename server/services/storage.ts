import fs from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { AppData, Source, SyncTask, SSHKey, SyncLog } from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')
const SOURCES_FILE = path.join(DATA_DIR, 'sources.json')
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json')
const SSH_KEYS_FILE = path.join(DATA_DIR, 'ssh-keys.json')
const LOGS_DIR = path.join(DATA_DIR, 'logs')
const SSH_KEYS_DIR = path.join(DATA_DIR, 'ssh-keys')

function ensureDirs() {
  for (const dir of [DATA_DIR, LOGS_DIR, SSH_KEYS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data) as T
  } catch {
    return fallback
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// Sources
export async function getSources(): Promise<Source[]> {
  ensureDirs()
  return readJson<Source[]>(SOURCES_FILE, [])
}

export async function saveSources(sources: Source[]): Promise<void> {
  ensureDirs()
  await writeJson(SOURCES_FILE, sources)
}

// Tasks
export async function getTasks(): Promise<SyncTask[]> {
  ensureDirs()
  return readJson<SyncTask[]>(TASKS_FILE, [])
}

export async function saveTasks(tasks: SyncTask[]): Promise<void> {
  ensureDirs()
  await writeJson(TASKS_FILE, tasks)
}

// SSH Keys
export async function getSSHKeys(): Promise<SSHKey[]> {
  ensureDirs()
  return readJson<SSHKey[]>(SSH_KEYS_FILE, [])
}

export async function saveSSHKeys(keys: SSHKey[]): Promise<void> {
  ensureDirs()
  await writeJson(SSH_KEYS_FILE, keys)
}

export function getSSHKeysDir(): string {
  ensureDirs()
  return SSH_KEYS_DIR
}

// Logs
export async function appendLog(log: SyncLog): Promise<void> {
  ensureDirs()
  const logFile = path.join(LOGS_DIR, `${log.taskId}.json`)
  const logs = await readJson<SyncLog[]>(logFile, [])
  logs.push(log)
  // Keep last 100 logs per task
  if (logs.length > 100) {
    logs.splice(0, logs.length - 100)
  }
  await writeJson(logFile, logs)
}

export async function getTaskLogs(taskId: string): Promise<SyncLog[]> {
  ensureDirs()
  const logFile = path.join(LOGS_DIR, `${taskId}.json`)
  return readJson<SyncLog[]>(logFile, [])
}

export function getTmpDir(): string {
  const tmpDir = path.resolve(__dirname, '../../tmp')
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true })
  }
  return tmpDir
}
