import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import sourcesRouter from './routes/sources.js'
import tasksRouter from './routes/tasks.js'
import sshKeysRouter from './routes/ssh-keys.js'
import { initScheduler } from './services/scheduler.js'
import { logger } from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001

app.use(express.json())

// API routes
app.use('/api/sources', sourcesRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/ssh-keys', sshKeysRouter)

// Serve static frontend in production
const clientDir = path.resolve(__dirname, '../client')
if (existsSync(clientDir)) {
  app.use(express.static(clientDir))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'))
  })
}

async function start() {
  await initScheduler()
  app.listen(PORT, () => {
    logger.info(`GitSync server running on http://localhost:${PORT}`)
  })
}

start().catch(err => {
  logger.error(`Failed to start server: ${err}`)
  process.exit(1)
})
