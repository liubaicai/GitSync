import cron from 'node-cron'
import { getTasks } from './storage.js'
import { enqueueSync } from './sync-queue.js'
import { logger } from '../logger.js'

const scheduledJobs = new Map<string, cron.ScheduledTask>()

export async function initScheduler(): Promise<void> {
  const tasks = await getTasks()
  for (const task of tasks) {
    if (task.schedule.enabled && cron.validate(task.schedule.cron)) {
      scheduleTask(task.id, task.schedule.cron)
    }
  }
  logger.info(`Scheduler initialized with ${scheduledJobs.size} scheduled tasks`)
}

export function scheduleTask(taskId: string, cronExpr: string): void {
  // Remove existing schedule if any
  unscheduleTask(taskId)

  if (!cron.validate(cronExpr)) {
    logger.warn(`Invalid cron expression for task ${taskId}: ${cronExpr}`)
    return
  }

  const job = cron.schedule(cronExpr, () => {
    logger.info(`Scheduled sync triggered for task ${taskId}`)
    enqueueSync(taskId).catch(err => {
      logger.error(`Scheduled sync failed for task ${taskId}: ${err}`)
    })
  })

  scheduledJobs.set(taskId, job)
  logger.info(`Task ${taskId} scheduled with cron: ${cronExpr}`)
}

export function unscheduleTask(taskId: string): void {
  const existing = scheduledJobs.get(taskId)
  if (existing) {
    existing.stop()
    scheduledJobs.delete(taskId)
  }
}

export function getScheduledTaskIds(): string[] {
  return Array.from(scheduledJobs.keys())
}
