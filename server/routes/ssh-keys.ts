import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { getSSHKeys, saveSSHKeys, getSSHKeysDir } from '../services/storage.js'
import type { SSHKey } from '../types.js'

const execAsync = promisify(exec)
const router = Router()

router.get('/', async (_req, res) => {
  const keys = await getSSHKeys()
  // Don't expose private key path details
  res.json(keys.map(k => ({ ...k, privateKeyPath: '***' })))
})

router.post('/', async (req, res) => {
  const { name, privateKey, publicKey, generate } = req.body
  if (!name) {
    res.status(400).json({ error: 'Missing required field: name' })
    return
  }

  const id = uuidv4()
  const keysDir = getSSHKeysDir()
  const privateKeyPath = `${id}_id_rsa`
  const privateKeyFullPath = path.join(keysDir, privateKeyPath)
  const publicKeyFullPath = `${privateKeyFullPath}.pub`

  let pubKeyContent: string

  if (generate) {
    // Generate new SSH key pair
    await execAsync(`ssh-keygen -t rsa -b 4096 -f "${privateKeyFullPath}" -N "" -C "gitsync-${name}"`)
    pubKeyContent = await fs.readFile(publicKeyFullPath, 'utf-8')
  } else if (privateKey && publicKey) {
    // Save uploaded keys
    await fs.writeFile(privateKeyFullPath, privateKey, { mode: 0o600 })
    await fs.writeFile(publicKeyFullPath, publicKey)
    pubKeyContent = publicKey
  } else {
    res.status(400).json({ error: 'Either set generate=true or provide privateKey and publicKey' })
    return
  }

  // Ensure private key has correct permissions
  try {
    await fs.chmod(privateKeyFullPath, 0o600)
  } catch { /* Windows may not support chmod fully */ }

  const sshKey: SSHKey = {
    id,
    name,
    privateKeyPath,
    publicKey: pubKeyContent.trim(),
    createdAt: new Date().toISOString(),
  }

  const keys = await getSSHKeys()
  keys.push(sshKey)
  await saveSSHKeys(keys)

  res.status(201).json({ ...sshKey, privateKeyPath: '***' })
})

router.delete('/:id', async (req, res) => {
  const keys = await getSSHKeys()
  const idx = keys.findIndex(k => k.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ error: 'SSH key not found' })
    return
  }

  // Delete key files
  const keysDir = getSSHKeysDir()
  const privateKeyFullPath = path.join(keysDir, keys[idx].privateKeyPath)
  try {
    await fs.unlink(privateKeyFullPath)
    await fs.unlink(`${privateKeyFullPath}.pub`)
  } catch { /* ignore if files don't exist */ }

  keys.splice(idx, 1)
  await saveSSHKeys(keys)
  res.status(204).send()
})

router.get('/:id/public', async (req, res) => {
  const keys = await getSSHKeys()
  const key = keys.find(k => k.id === req.params.id)
  if (!key) {
    res.status(404).json({ error: 'SSH key not found' })
    return
  }
  res.json({ publicKey: key.publicKey })
})

export default router
