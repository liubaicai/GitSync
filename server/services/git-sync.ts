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
 * Resolve the SOCKS5 proxy URL from the source configuration.
 */
async function resolveProxy(endpoint: RepoEndpoint): Promise<string | undefined> {
  if (!endpoint.sourceId) return undefined
  const sources = await getSources()
  const source = sources.find(s => s.id === endpoint.sourceId)
  return source?.proxy || undefined
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

  let proxyArg = ''
  if (source.proxy) {
    // Parse socks5://host:port for SSH ProxyCommand
    const proxyUrl = new URL(source.proxy)
    const proxyHost = proxyUrl.hostname
    const proxyPort = proxyUrl.port || '1080'
    // Use ncat/nc with SOCKS5 support as ProxyCommand
    proxyArg = ` -o ProxyCommand="nc -X 5 -x ${proxyHost}:${proxyPort} %h %p"`
  }

  return `ssh -i "${keyPath}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null${proxyArg}`
}

/**
 * Apply proxy env vars for HTTPS git operations.
 */
function applyProxyEnv(env: Record<string, string>, proxy: string | undefined): void {
  if (!proxy) return
  env.ALL_PROXY = proxy
  env.http_proxy = proxy
  env.https_proxy = proxy
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
    const logLines: string[] = []

    // Build env with potential SSH commands
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      GIT_SSL_NO_VERIFY: 'true',
    }

    // For clone, use source SSH command and proxy
    const sourceSSH = await resolveSSHCommand(task.sourceRepo)
    if (sourceSSH) {
      env.GIT_SSH_COMMAND = sourceSSH
    }
    const sourceProxy = await resolveProxy(task.sourceRepo)
    applyProxyEnv(env, sourceProxy)

    // 1. Mirror clone or incremental fetch
    if (existsSync(path.join(tmpDir, 'HEAD'))) {
      // Existing mirror: update remote URL and fetch incrementally
      logger.info(`[${task.name}] Updating existing mirror cache...`)
      logLines.push('[fetch] 使用已有镜像缓存，增量拉取')
      await execAsync(`git -c http.sslVerify=false remote set-url origin "${sourceUrl}"`, { cwd: tmpDir, env, timeout: 30_000 })
      const fetchResult = await execAsync('git -c http.sslVerify=false remote update --prune', { cwd: tmpDir, env, timeout: 600_000 })
      if (fetchResult.stderr) logLines.push(fetchResult.stderr.trim())
    } else {
      // No cache: full mirror clone
      if (existsSync(tmpDir)) {
        await fs.rm(tmpDir, { recursive: true, force: true })
      }
      logger.info(`[${task.name}] Mirror cloning from source...`)
      logLines.push('[clone] 全量镜像克隆')
      const cloneResult = await execAsync(`git -c http.sslVerify=false clone --mirror "${sourceUrl}" "${tmpDir}"`, {
        env,
        timeout: 600_000,
      })
      if (cloneResult.stderr) logLines.push(cloneResult.stderr.trim())
    }

    // For push, use target SSH command and proxy
    const targetSSH = await resolveSSHCommand(task.targetRepo)
    const pushEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      GIT_SSL_NO_VERIFY: 'true',
    }
    if (targetSSH) {
      pushEnv.GIT_SSH_COMMAND = targetSSH
    }
    const targetProxy = await resolveProxy(task.targetRepo)
    applyProxyEnv(pushEnv, targetProxy)

    // 2. Clean up platform-specific refs from the mirror
    logger.info(`[${task.name}] Cleaning up excluded refs...`)
    await cleanupExcludedRefs(tmpDir)

    // 3. Push with ref filtering
    const refs = buildPushRefs()
    logger.info(`[${task.name}] Pushing to target...`)
    logLines.push('[push] 推送到目标仓库')
    const pushResult = await execAsync(`git -c http.sslVerify=false push --force --prune "${targetUrl}" ${refs.join(' ')}`, {
      cwd: tmpDir,
      env: pushEnv,
      timeout: 600_000,
    })
    if (pushResult.stdout) logLines.push(pushResult.stdout.trim())
    if (pushResult.stderr) logLines.push(pushResult.stderr.trim())

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
      message: '同步完成',
      output: logLines.join('\n'),
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
