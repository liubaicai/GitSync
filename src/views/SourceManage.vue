<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Source, SSHKey } from '@/types'
import { sourcesApi, sshKeysApi } from '@/api'

const sources = ref<Source[]>([])
const sshKeys = ref<SSHKey[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const form = ref({
  name: '',
  platform: 'github' as Source['platform'],
  baseUrl: '',
  authType: 'https' as Source['authType'],
  httpsToken: '',
  sshKeyId: '',
})

const platformDefaults: Record<string, string> = {
  github: 'https://github.com',
  gitlab: 'https://gitlab.com',
  gitea: '',
  custom: '',
}

function onPlatformChange() {
  form.value.baseUrl = platformDefaults[form.value.platform] || ''
}

async function loadData() {
  loading.value = true
  try {
    const [s, k] = await Promise.all([sourcesApi.list(), sshKeysApi.list()])
    sources.value = s
    sshKeys.value = k
  } catch (e) {
    console.error(e)
  }
  loading.value = false
}

onMounted(loadData)

function openCreate() {
  editingId.value = null
  form.value = { name: '', platform: 'github', baseUrl: 'https://github.com', authType: 'https', httpsToken: '', sshKeyId: '' }
  showModal.value = true
}

function openEdit(source: Source) {
  editingId.value = source.id
  form.value = {
    name: source.name,
    platform: source.platform,
    baseUrl: source.baseUrl,
    authType: source.authType,
    httpsToken: '',
    sshKeyId: source.sshKeyId || '',
  }
  showModal.value = true
}

async function handleSave() {
  if (!form.value.name || !form.value.baseUrl) {
    alert('请填写名称和平台地址')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await sourcesApi.update(editingId.value, form.value)
    } else {
      await sourcesApi.create(form.value)
    }
    showModal.value = false
    await loadData()
  } catch (e: unknown) {
    alert(`保存失败: ${e instanceof Error ? e.message : e}`)
  }
  saving.value = false
}

async function handleDelete(id: string) {
  if (!confirm('确定要删除该数据源吗？')) return
  try {
    await sourcesApi.delete(id)
    sources.value = sources.value.filter(s => s.id !== id)
  } catch (e: unknown) {
    alert(`删除失败: ${e instanceof Error ? e.message : e}`)
  }
}

function platformLabel(p: string): string {
  const labels: Record<string, string> = { github: 'GitHub', gitlab: 'GitLab', gitea: 'Gitea', custom: '自定义' }
  return labels[p] || p
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">数据源管理</h1>
      <button class="btn btn-primary" @click="openCreate">+ 新增数据源</button>
    </div>

    <div v-if="loading" class="empty-state">加载中...</div>
    <div v-else-if="sources.length === 0" class="empty-state">
      <p>暂无数据源配置</p>
      <button class="btn btn-primary" @click="openCreate">添加第一个数据源</button>
    </div>
    <div v-else class="source-list">
      <div v-for="source in sources" :key="source.id" class="card source-card">
        <div class="source-header">
          <div>
            <div class="source-name">{{ source.name }}</div>
            <div class="source-meta">
              <span class="badge badge-idle">{{ platformLabel(source.platform) }}</span>
              <span class="badge badge-idle">{{ source.authType.toUpperCase() }}</span>
            </div>
          </div>
          <div class="source-actions">
            <button class="btn btn-ghost btn-sm" @click="openEdit(source)">编辑</button>
            <button class="btn btn-ghost btn-sm" style="color: var(--danger)" @click="handleDelete(source.id)">删除</button>
          </div>
        </div>
        <div class="source-url mono">{{ source.baseUrl }}</div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @mousedown.self="showModal = false">
      <div class="modal">
        <div class="modal-title">{{ editingId ? '编辑数据源' : '新增数据源' }}</div>
        <form @submit.prevent="handleSave">
          <div class="form-group">
            <label>名称</label>
            <input v-model="form.name" placeholder="例如：我的 GitHub" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>平台类型</label>
              <select v-model="form.platform" @change="onPlatformChange">
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="gitea">Gitea</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            <div class="form-group">
              <label>认证方式</label>
              <select v-model="form.authType">
                <option value="https">HTTPS</option>
                <option value="ssh">SSH</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>平台地址</label>
            <input v-model="form.baseUrl" placeholder="https://github.com" class="mono" />
          </div>
          <div v-if="form.authType === 'https'" class="form-group">
            <label>Access Token</label>
            <input v-model="form.httpsToken" type="password" placeholder="Personal Access Token" />
          </div>
          <div v-if="form.authType === 'ssh'" class="form-group">
            <label>SSH 密钥</label>
            <select v-model="form.sshKeyId">
              <option value="">不指定</option>
              <option v-for="k in sshKeys" :key="k.id" :value="k.id">{{ k.name }}</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="showModal = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.source-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.source-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.source-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.source-meta {
  display: flex;
  gap: 6px;
}

.source-actions {
  display: flex;
  gap: 4px;
}

.source-url {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
