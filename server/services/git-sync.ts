import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { getTasks, saveTasks, getSources, getSSHKeys, appendLog, getTmpDir } from './storage.js'
import type { SyncTask, RepoEndpoint, Source, SSHKey } from '../types.js'
import { logger } from '../logger.js'

const execAsync = promisify(exec)

/**
 * Build the authenticated repo URL for HTTPS, or the raw URL for SSH.
 */
async function resolveRepoUrl(endpoint: RepoEndpoint): Promise<string> {
  if (endpoint.authType === 'https' && endpoint.sourceId) {
    const sources = await getSources()
    const source = sources.find(s => s.id === endpoint.sourceId)
    if (source?.httpsToken) {
      const url = new URL(endpoint.repoUrl)
      url.username = 'oauth2'
      url.password = source.httpsToken
      return url.toString()
    }
  }
  return endpoint.repoUrl
}

/**
 * Build GIT_SSH_COMMAND if the endpoint uses SSH with a configured key.
 */
async function resolveSSHCommand(endpoint: RepoEndpoint): Promise<string | undefined> {
  if (endpoint.authType !== 'ssh' || !endpoint.sourceId) return undefined

  const sources = await getSources()
  const source = sources.find(s => s.id === endpoint.sourceId)
  if (!source?.sshKeyId) return undefined

  const keys = await getSSHKeys()
  const key = keys.find(k => k.id === source.sshKeyId)
  if (!key) return undefined

  const keyPath = path.isAbsolute(key.privateKeyPath) ? key.privateKeyPath : path.resolve(getTmpDir(), '..', 'data', 'ssh-keys', key.privateKeyPath)
  return `ssh -i "${keyPath}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`
}

function buildPushRefs(): string[] {
  return [
    'refs/heads/*:refs/heads/*',
    'refs/tags/*:refs/tags/*',
    'refs/notes/*:refs/notes/*',
  ]
}

const EXCLUDED_REF_PREFIXES = [
  'refs/gitlab/',
  'refs/merge-requests/',
  'refs/pipelines/',
  'refs/environments/',
]

/**
 * Remove platform-specific refs from a mirror clone to avoid push errors.
 */
async function cleanupExcludedRefs(repoDir: string): Promise<void> {
  const { stdout } = await execAsync('git for-each-ref --format="%(refname)"', {
    cwd: repoDir,
    timeout: 30_000,
  })
  const refsToDelete = stdout
    .split('\n')
    .map(r => r.trim().replace(/^"|"$/g, ''))
    .filter(r => r && EXCLUDED_REF_PREFIXES.some(p => r.startsWith(p)))

  for (const ref of refsToDelete) {
    await execAsync(`git update-ref -d "${ref}"`, { cwd: repoDir, timeout: 10_000 })
  }
}

/**
 * Execute a single sync task: mirror clone from source, then push to target.
 */
export async function executeSync(task: SyncTask): Promise<void> {
  const tmpDir = path.join(getTmpDir(), task.id)
  const startTime = Date.now()

  // Update status to running
  const tasks = await getTasks()
  const idx = tasks.findIndex(t => t.id === task.id)
  if (idx !== -1) {
    tasks[idx].status = 'running'
    await saveTasks(tasks)
  }

  try {
    // Resolve URLs
    const sourceUrl = await resolveRepoUrl(task.sourceRepo)
    const targetUrl = await resolveRepoUrl(task.targetRepo)

    // Build env with potential SSH commands
    const env: Record<string, string> = { ...process.env as Record<string, string> }

    // For clone, use source SSH command
    const sourceSSH = await resolveSSHCommand(task.sourceRepo)
    if (sourceSSH) {
      env.GIT_SSH_COMMAND = sourceSSH
    }

    // 1. Mirror clone or incremental fetch
    if (existsSync(path.join(tmpDir, 'HEAD'))) {
      // Existing mirror: update remote URL and fetch incrementally
      logger.info(`[${task.name}] Updating existing mirror cache...`)
      await execAsync(`git remote set-url origin "${sourceUrl}"`, { cwd: tmpDir, env, timeout: 30_000 })
      await execAsync('git remote update --prune', { cwd: tmpDir, env, timeout: 600_000 })
    } else {
      // No cache: full mirror clone
      if (existsSync(tmpDir)) {
        await fs.rm(tmpDir, { recursive: true, force: true })
      }
      logger.info(`[${task.name}] Mirror cloning from source...`)
      await execAsync(`git clone --mirror "${sourceUrl}" "${tmpDir}"`, {
        env,
        timeout: 600_000,
      })
    }

    // For push, use target SSH command
    const targetSSH = await resolveSSHCommand(task.targetRepo)
    const pushEnv: Record<string, string> = { ...process.env as Record<string, string> }
    if (targetSSH) {
      pushEnv.GIT_SSH_COMMAND = targetSSH
    }

    // 2. Clean up platform-specific refs from the mirror
    logger.info(`[${task.name}] Cleaning up excluded refs...`)
    await cleanupExcludedRefs(tmpDir)

    // 3. Push with ref filtering
    const refs = buildPushRefs()
    logger.info(`[${task.name}] Pushing to target...`)
    await execAsync(`git push --force --prune "${targetUrl}" ${refs.join(' ')}`, {
      cwd: tmpDir,
      env: pushEnv,
      timeout: 600_000,
    })

    // 4. Update status
    const duration = Date.now() - startTime
    const tasksAfter = await getTasks()
    const idxAfter = tasksAfter.findIndex(t => t.id === task.id)
    if (idxAfter !== -1) {
      tasksAfter[idxAfter].status = 'success'
      tasksAfter[idxAfter].lastSyncAt = new Date().toISOString()
      tasksAfter[idxAfter].lastError = undefined
      await saveTasks(tasksAfter)
    }

    await appendLog({
      taskId: task.id,
      timestamp: new Date().toISOString(),
      success: true,
      message: 'Sync completed successfully',
      duration,
    })

    logger.info(`[${task.name}] Sync completed in ${duration}ms`)
  } catch (err: unknown) {
    const duration = Date.now() - startTime
    const errorMsg = err instanceof Error ? err.message : String(err)

    const tasksAfter = await getTasks()
    const idxAfter = tasksAfter.findIndex(t => t.id === task.id)
    if (idxAfter !== -1) {
      tasksAfter[idxAfter].status = 'failed'
      tasksAfter[idxAfter].lastSyncAt = new Date().toISOString()
      tasksAfter[idxAfter].lastError = errorMsg
      await saveTasks(tasksAfter)
    }

    await appendLog({
      taskId: task.id,
      timestamp: new Date().toISOString(),
      success: false,
      message: errorMsg,
      duration,
    })

    logger.error(`[${task.name}] Sync failed: ${errorMsg}`)
  }
}
