<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { SSHKey } from '@/types'
import { sshKeysApi } from '@/api'

const keys = ref<SSHKey[]>([])
const loading = ref(true)
const showModal = ref(false)
const saving = ref(false)
const copiedId = ref<string | null>(null)

const form = ref({
  name: '',
  mode: 'generate' as 'generate' | 'upload',
  privateKey: '',
  publicKey: '',
})

async function loadKeys() {
  loading.value = true
  try {
    keys.value = await sshKeysApi.list()
  } catch (e) {
    console.error(e)
  }
  loading.value = false
}

onMounted(loadKeys)

function openCreate() {
  form.value = { name: '', mode: 'generate', privateKey: '', publicKey: '' }
  showModal.value = true
}

async function handleSave() {
  if (!form.value.name) {
    alert('请输入密钥名称')
    return
  }

  saving.value = true
  try {
    if (form.value.mode === 'generate') {
      await sshKeysApi.create({ name: form.value.name, generate: true })
    } else {
      if (!form.value.privateKey || !form.value.publicKey) {
        alert('请粘贴私钥和公钥内容')
        saving.value = false
        return
      }
      await sshKeysApi.create({
        name: form.value.name,
        privateKey: form.value.privateKey,
        publicKey: form.value.publicKey,
      })
    }
    showModal.value = false
    await loadKeys()
  } catch (e: unknown) {
    alert(`操作失败: ${e instanceof Error ? e.message : e}`)
  }
  saving.value = false
}

async function handleDelete(id: string) {
  if (!confirm('确定要删除该 SSH 密钥吗？')) return
  try {
    await sshKeysApi.delete(id)
    keys.value = keys.value.filter(k => k.id !== id)
  } catch (e: unknown) {
    alert(`删除失败: ${e instanceof Error ? e.message : e}`)
  }
}

async function copyPublicKey(key: SSHKey) {
  try {
    const data = await sshKeysApi.getPublicKey(key.id)
    await navigator.clipboard.writeText(data.publicKey)
    copiedId.value = key.id
    setTimeout(() => { copiedId.value = null }, 2000)
  } catch (e: unknown) {
    alert(`复制失败: ${e instanceof Error ? e.message : e}`)
  }
}

function fingerprint(pubKey: string): string {
  if (!pubKey || pubKey === '***') return '***'
  const parts = pubKey.split(' ')
  if (parts.length >= 2) {
    return parts[1].substring(0, 16) + '...'
  }
  return pubKey.substring(0, 20) + '...'
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">SSH 密钥管理</h1>
      <button class="btn btn-primary" @click="openCreate">+ 新增密钥</button>
    </div>

    <div v-if="loading" class="empty-state">加载中...</div>
    <div v-else-if="keys.length === 0" class="empty-state">
      <p>暂无 SSH 密钥</p>
      <button class="btn btn-primary" @click="openCreate">创建第一个密钥</button>
    </div>
    <div v-else class="key-list">
      <div v-for="key in keys" :key="key.id" class="card key-card">
        <div class="key-header">
          <div class="key-name">{{ key.name }}</div>
          <div class="key-actions">
            <button
              class="btn btn-ghost btn-sm"
              @click="copyPublicKey(key)"
            >
              {{ copiedId === key.id ? '已复制!' : '复制公钥' }}
            </button>
            <button class="btn btn-ghost btn-sm" style="color: var(--danger)" @click="handleDelete(key.id)">删除</button>
          </div>
        </div>
        <div class="key-info">
          <span class="mono key-fingerprint">{{ fingerprint(key.publicKey) }}</span>
          <span class="key-date">创建于 {{ new Date(key.createdAt).toLocaleDateString('zh-CN') }}</span>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showModal" class="modal-overlay" @mousedown.self="showModal = false">
      <div class="modal">
        <div class="modal-title">新增 SSH 密钥</div>
        <form @submit.prevent="handleSave">
          <div class="form-group">
            <label>密钥名称</label>
            <input v-model="form.name" placeholder="例如：生产服务器密钥" />
          </div>
          <div class="form-group">
            <label>方式</label>
            <select v-model="form.mode">
              <option value="generate">自动生成</option>
              <option value="upload">手动粘贴</option>
            </select>
          </div>
          <template v-if="form.mode === 'upload'">
            <div class="form-group">
              <label>私钥</label>
              <textarea v-model="form.privateKey" rows="6" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" class="mono" />
            </div>
            <div class="form-group">
              <label>公钥</label>
              <textarea v-model="form.publicKey" rows="3" placeholder="ssh-rsa AAAA..." class="mono" />
            </div>
          </template>
          <div v-else class="generate-note">
            将自动生成 RSA 4096 位密钥对，创建后可复制公钥添加到目标平台。
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="showModal = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? '处理中...' : '确定' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.key-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.key-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.key-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.key-name {
  font-weight: 600;
}

.key-actions {
  display: flex;
  gap: 4px;
}

.key-info {
  display: flex;
  gap: 16px;
  align-items: center;
}

.key-fingerprint {
  font-size: 0.85rem;
  color: var(--text-secondary);
  background: var(--bg-input);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.key-date {
  font-size: 0.8rem;
  color: var(--text-muted);
}

textarea {
  resize: vertical;
  min-height: 60px;
}

.generate-note {
  padding: 12px 16px;
  background: var(--accent-dim);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-bottom: 8px;
}
</style>
