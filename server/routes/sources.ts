import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getSources, saveSources } from '../services/storage.js'
import type { Source } from '../types.js'

const router = Router()

router.get('/', async (_req, res) => {
  const sources = await getSources()
  // Don't expose tokens in list view
  const safe = sources.map(s => ({ ...s, httpsToken: s.httpsToken ? '***' : undefined }))
  res.json(safe)
})

router.post('/', async (req, res) => {
  const { name, platform, baseUrl, authType, httpsToken, sshKeyId, proxy } = req.body
  if (!name || !platform || !baseUrl || !authType) {
    res.status(400).json({ error: 'Missing required fields: name, platform, baseUrl, authType' })
    return
  }

  const source: Source = {
    id: uuidv4(),
    name,
    platform,
    baseUrl,
    authType,
    httpsToken,
    sshKeyId,
    proxy,
    createdAt: new Date().toISOString(),
  }

  const sources = await getSources()
  sources.push(source)
  await saveSources(sources)
  res.status(201).json({ ...source, httpsToken: source.httpsToken ? '***' : undefined })
})

router.put('/:id', async (req, res) => {
  const sources = await getSources()
  const idx = sources.findIndex(s => s.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ error: 'Source not found' })
    return
  }

  const { name, platform, baseUrl, authType, httpsToken, sshKeyId, proxy } = req.body
  if (name) sources[idx].name = name
  if (platform) sources[idx].platform = platform
  if (baseUrl) sources[idx].baseUrl = baseUrl
  if (authType) sources[idx].authType = authType
  if (httpsToken !== undefined) sources[idx].httpsToken = httpsToken
  if (sshKeyId !== undefined) sources[idx].sshKeyId = sshKeyId
  if (proxy !== undefined) sources[idx].proxy = proxy

  await saveSources(sources)
  res.json({ ...sources[idx], httpsToken: sources[idx].httpsToken ? '***' : undefined })
})

router.delete('/:id', async (req, res) => {
  const sources = await getSources()
  const idx = sources.findIndex(s => s.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ error: 'Source not found' })
    return
  }

  sources.splice(idx, 1)
  await saveSources(sources)
  res.status(204).send()
})

export default router
