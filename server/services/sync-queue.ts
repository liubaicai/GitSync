import { getTasks } from './storage.js'
import { executeSync } from './git-sync.js'
import { logger } from '../logger.js'

interface QueueItem {
  taskId: string
  resolve: () => void
  reject: (err: unknown) => void
}

const queue: QueueItem[] = []
let processing = false

/**
 * Enqueue a sync task. Tasks are executed sequentially (FIFO).
 * Returns a promise that resolves when the task finishes (or rejects on error).
 * If the task is already queued or running, the request is rejected immediately.
 */
export function enqueueSync(taskId: string): Promise<void> {
  // Prevent duplicate entries in the queue
  if (queue.some(item => item.taskId === taskId)) {
    logger.info(`Task ${taskId} is already queued, skipping`)
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    queue.push({ taskId, resolve, reject })
    logger.info(`Task ${taskId} enqueued (queue length: ${queue.length})`)
    processQueue()
  })
}

/**
 * Get the current queue status.
 */
export function getQueueStatus(): { processing: boolean; pending: string[] } {
  return {
    processing,
    pending: queue.map(item => item.taskId),
  }
}

async function processQueue(): Promise<void> {
  if (processing) return
  if (queue.length === 0) return

  processing = true
  const item = queue.shift()!

  try {
    const tasks = await getTasks()
    const task = tasks.find(t => t.id === item.taskId)

    if (!task) {
      logger.warn(`Queued task ${item.taskId} not found, skipping`)
      item.resolve()
    } else if (task.status === 'running') {
      logger.info(`Task ${item.taskId} is already running, skipping`)
      item.resolve()
    } else {
      await executeSync(task)
      item.resolve()
    }
  } catch (err) {
    // executeSync should handle its own errors, but catch anything unexpected
    logger.error(`Unexpected error processing queued task ${item.taskId}: ${err}`)
    item.reject(err)
  } finally {
    processing = false
    // Process next item in queue
    if (queue.length > 0) {
      processQueue()
    }
  }
}
