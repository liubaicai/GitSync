import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getTasks, saveTasks, getTaskLogs } from '../services/storage.js'
import { enqueueSync } from '../services/sync-queue.js'
import { scheduleTask, unscheduleTask } from '../services/scheduler.js'
import type { SyncTask } from '../types.js'

const router = Router()

router.get('/', async (_req, res) => {
  const tasks = await getTasks()
  res.json(tasks)
})

router.post('/', async (req, res) => {
  const { name, sourceRepo, targetRepo, schedule } = req.body
  if (!name || !sourceRepo?.repoUrl || !targetRepo?.repoUrl) {
    res.status(400).json({ error: 'Missing required fields: name, sourceRepo.repoUrl, targetRepo.repoUrl' })
    return
  }

  const task: SyncTask = {
    id: uuidv4(),
    name,
    sourceRepo: {
      sourceId: sourceRepo.sourceId,
      repoUrl: sourceRepo.repoUrl,
      authType: sourceRepo.authType || 'https',
    },
    targetRepo: {
      sourceId: targetRepo.sourceId,
      repoUrl: targetRepo.repoUrl,
      authType: targetRepo.authType || 'https',
    },
    schedule: {
      enabled: schedule?.enabled ?? false,
      cron: schedule?.cron || '0 */6 * * *',
    },
    status: 'idle',
    createdAt: new Date().toISOString(),
  }

  const tasks = await getTasks()
  tasks.push(task)
  await saveTasks(tasks)

  if (task.schedule.enabled) {
    scheduleTask(task.id, task.schedule.cron)
  }

  res.status(201).json(task)
})

router.put('/:id', async (req, res) => {
  const tasks = await getTasks()
  const idx = tasks.findIndex(t => t.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ error: 'Task not found' })
    return
  }

  const { name, sourceRepo, targetRepo, schedule } = req.body
  if (name) tasks[idx].name = name
  if (sourceRepo) tasks[idx].sourceRepo = { ...tasks[idx].sourceRepo, ...sourceRepo }
  if (targetRepo) tasks[idx].targetRepo = { ...tasks[idx].targetRepo, ...targetRepo }
  if (schedule) {
    tasks[idx].schedule = { ...tasks[idx].schedule, ...schedule }
    // Update scheduler
    if (tasks[idx].schedule.enabled) {
      scheduleTask(tasks[idx].id, tasks[idx].schedule.cron)
    } else {
      unscheduleTask(tasks[idx].id)
    }
  }

  await saveTasks(tasks)
  res.json(tasks[idx])
})

router.delete('/:id', async (req, res) => {
  const tasks = await getTasks()
  const idx = tasks.findIndex(t => t.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ error: 'Task not found' })
    return
  }

  unscheduleTask(tasks[idx].id)
  tasks.splice(idx, 1)
  await saveTasks(tasks)
  res.status(204).send()
})

// Manual sync trigger
router.post('/:id/sync', async (req, res) => {
  const tasks = await getTasks()
  const task = tasks.find(t => t.id === req.params.id)
  if (!task) {
    res.status(404).json({ error: 'Task not found' })
    return
  }

  if (task.status === 'running') {
    res.status(409).json({ error: 'Task is already running' })
    return
  }

  // Enqueue sync task, respond immediately
  res.json({ message: 'Sync started', taskId: task.id })
  enqueueSync(task.id).catch(err => {
    console.error(`Manual sync failed for task ${task.id}:`, err)
  })
})

// Get task logs
router.get('/:id/logs', async (req, res) => {
  const logs = await getTaskLogs(req.params.id)
  res.json(logs)
})

export default router
