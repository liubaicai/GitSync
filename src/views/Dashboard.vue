<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { SyncTask, SyncLog, Source } from '@/types'
import { tasksApi, sourcesApi } from '@/api'
import TaskCard from '@/components/TaskCard.vue'

const tasks = ref<SyncTask[]>([])
const sources = ref<Source[]>([])
const loading = ref(true)
const logsModal = ref(false)
const logsData = ref<SyncLog[]>([])
const logsTaskName = ref('')
const expandedLogIndex = ref<number | null>(null)

// Task modal state
const showTaskModal = ref(false)
const editingTaskId = ref<string | null>(null)
const saving = ref(false)

const defaultForm = () => ({
  name: '',
  sourceRepo: {
    sourceId: '',
    repoUrl: '',
    authType: 'https' as 'https' | 'ssh',
  },
  targetRepo: {
    sourceId: '',
    repoUrl: '',
    authType: 'https' as 'https' | 'ssh',
  },
  schedule: {
    enabled: false,
    cron: '0 */6 * * *',
  },
})

const form = ref(defaultForm())

const cronPresets = [
  { label: '每小时', value: '0 * * * *' },
  { label: '每 6 小时', value: '0 */6 * * *' },
  { label: '每天', value: '0 0 * * *' },
  { label: '每周', value: '0 0 * * 0' },
  { label: '自定义', value: 'custom' },
]

const selectedCronPreset = ref('0 */6 * * *')
const customCron = ref('')

function onCronPresetChange() {
  if (selectedCronPreset.value !== 'custom') {
    form.value.schedule.cron = selectedCronPreset.value
  }
}

function onSourceSelect(side: 'source' | 'target') {
  const field = side === 'source' ? form.value.sourceRepo : form.value.targetRepo
  const src = sources.value.find(s => s.id === field.sourceId)
  if (src) {
    field.authType = src.authType
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadTasks() {
  try {
    tasks.value = await tasksApi.list()
  } catch (e) {
    console.error('Failed to load tasks', e)
  } finally {
    loading.value = false
  }
}

function startPolling() {
  pollTimer = setInterval(loadTasks, 5000)
}

onMounted(async () => {
  loadTasks()
  startPolling()
  try {
    sources.value = await sourcesApi.list()
  } catch { /* ignore */ }
})

// Stats
const totalTasks = () => tasks.value.length
const runningTasks = () => tasks.value.filter(t => t.status === 'running').length
const successTasks = () => tasks.value.filter(t => t.status === 'success').length
const failedTasks = () => tasks.value.filter(t => t.status === 'failed').length

function openCreate() {
  editingTaskId.value = null
  form.value = defaultForm()
  selectedCronPreset.value = '0 */6 * * *'
  customCron.value = ''
  showTaskModal.value = true
}

function openEdit(task: SyncTask) {
  editingTaskId.value = task.id
  form.value = {
    name: task.name,
    sourceRepo: { sourceId: '', ...task.sourceRepo },
    targetRepo: { sourceId: '', ...task.targetRepo },
    schedule: { ...task.schedule },
  }
  const preset = cronPresets.find(p => p.value === task.schedule.cron)
  if (preset) {
    selectedCronPreset.value = preset.value
  } else {
    selectedCronPreset.value = 'custom'
    customCron.value = task.schedule.cron
  }
  showTaskModal.value = true
}

async function handleTaskSave() {
  if (!form.value.name || !form.value.sourceRepo.repoUrl || !form.value.targetRepo.repoUrl) {
    alert('请填写任务名称和仓库地址')
    return
  }
  if (selectedCronPreset.value === 'custom' && form.value.schedule.enabled) {
    form.value.schedule.cron = customCron.value
  }
  saving.value = true
  try {
    if (editingTaskId.value) {
      await tasksApi.update(editingTaskId.value, form.value)
    } else {
      await tasksApi.create(form.value)
    }
    showTaskModal.value = false
    await loadTasks()
  } catch (e: unknown) {
    alert(`保存失败: ${e instanceof Error ? e.message : e}`)
  } finally {
    saving.value = false
  }
}

async function handleSync(id: string) {
  try {
    await tasksApi.sync(id)
    const task = tasks.value.find(t => t.id === id)
    if (task) task.status = 'running'
  } catch (e: unknown) {
    alert(`同步失败: ${e instanceof Error ? e.message : e}`)
  }
}

function handleEdit(id: string) {
  const task = tasks.value.find(t => t.id === id)
  if (task) openEdit(task)
}

async function handleDelete(id: string) {
  if (!confirm('确定要删除该同步任务吗？')) return
  try {
    await tasksApi.delete(id)
    tasks.value = tasks.value.filter(t => t.id !== id)
  } catch (e: unknown) {
    alert(`删除失败: ${e instanceof Error ? e.message : e}`)
  }
}

async function handleLogs(id: string) {
  const task = tasks.value.find(t => t.id === id)
  logsTaskName.value = task?.name || id
  expandedLogIndex.value = null
  try {
    logsData.value = await tasksApi.logs(id)
  } catch {
    logsData.value = []
  }
  logsModal.value = true
}

function toggleLogExpand(index: number) {
  expandedLogIndex.value = expandedLogIndex.value === index ? null : index
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">同步任务</h1>
      <button class="btn btn-primary" @click="openCreate">+ 新增任务</button>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ totalTasks() }}</div>
        <div class="stat-label">总任务</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--accent)">{{ runningTasks() }}</div>
        <div class="stat-label">运行中</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--success)">{{ successTasks() }}</div>
        <div class="stat-label">成功</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--danger)">{{ failedTasks() }}</div>
        <div class="stat-label">失败</div>
      </div>
    </div>

    <div v-if="loading" class="empty-state">
      <p>加载中...</p>
    </div>
    <div v-else-if="tasks.length === 0" class="empty-state">
      <p>暂无同步任务</p>
      <button class="btn btn-primary" @click="openCreate">创建第一个任务</button>
    </div>
    <div v-else class="task-list">
      <TaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        @sync="handleSync"
        @edit="handleEdit"
        @delete="handleDelete"
        @logs="handleLogs"
      />
    </div>

    <!-- Task Create/Edit Modal -->
    <div v-if="showTaskModal" class="modal-overlay" @mousedown.self="showTaskModal = false">
      <div class="modal task-modal">
        <div class="modal-title">{{ editingTaskId ? '编辑任务' : '新增同步任务' }}</div>
        <form @submit.prevent="handleTaskSave">
          <div class="form-group">
            <label>任务名称</label>
            <input v-model="form.name" placeholder="例如：my-project 同步" />
          </div>

          <fieldset class="fieldset">
            <legend>源仓库</legend>
            <div class="form-group" v-if="sources.length > 0">
              <label>选择数据源（可选）</label>
              <select v-model="form.sourceRepo.sourceId" @change="onSourceSelect('source')">
                <option value="">自定义</option>
                <option v-for="s in sources" :key="s.id" :value="s.id">{{ s.name }} ({{ s.platform }})</option>
              </select>
            </div>
            <div class="form-group">
              <label>仓库地址</label>
              <input v-model="form.sourceRepo.repoUrl" placeholder="https://github.com/user/repo.git" class="mono" />
            </div>
            <div class="form-group">
              <label>认证方式</label>
              <select v-model="form.sourceRepo.authType">
                <option value="https">HTTPS</option>
                <option value="ssh">SSH</option>
              </select>
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <legend>目标仓库</legend>
            <div class="form-group" v-if="sources.length > 0">
              <label>选择数据源（可选）</label>
              <select v-model="form.targetRepo.sourceId" @change="onSourceSelect('target')">
                <option value="">自定义</option>
                <option v-for="s in sources" :key="s.id" :value="s.id">{{ s.name }} ({{ s.platform }})</option>
              </select>
            </div>
            <div class="form-group">
              <label>仓库地址</label>
              <input v-model="form.targetRepo.repoUrl" placeholder="https://gitlab.com/user/repo.git" class="mono" />
            </div>
            <div class="form-group">
              <label>认证方式</label>
              <select v-model="form.targetRepo.authType">
                <option value="https">HTTPS</option>
                <option value="ssh">SSH</option>
              </select>
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <legend>定时同步</legend>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.schedule.enabled" />
                <span>启用定时同步</span>
              </label>
            </div>
            <div v-if="form.schedule.enabled" class="form-row">
              <div class="form-group">
                <label>同步频率</label>
                <select v-model="selectedCronPreset" @change="onCronPresetChange">
                  <option v-for="p in cronPresets" :key="p.value" :value="p.value">{{ p.label }}</option>
                </select>
              </div>
              <div v-if="selectedCronPreset === 'custom'" class="form-group">
                <label>Cron 表达式</label>
                <input v-model="customCron" placeholder="0 */6 * * *" class="mono" />
              </div>
            </div>
          </fieldset>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="showTaskModal = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? '保存中...' : (editingTaskId ? '保存修改' : '创建任务') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Logs Modal -->
    <div v-if="logsModal" class="modal-overlay" @mousedown.self="logsModal = false">
      <div class="modal logs-modal">
        <div class="modal-title">同步记录 - {{ logsTaskName }}</div>
        <div v-if="logsData.length === 0" class="empty-state" style="padding: 16px">
          <p>暂无记录</p>
        </div>
        <div v-else class="logs-list">
          <div
            v-for="(log, i) in [...logsData].reverse()"
            :key="i"
            class="log-entry"
            :class="{ 'log-success': log.success, 'log-failed': !log.success }"
          >
            <div class="log-header" @click="toggleLogExpand(i)">
              <span class="log-status">{{ log.success ? '✓' : '✗' }}</span>
              <span class="log-message-brief">{{ log.message }}</span>
              <span class="log-time mono">{{ new Date(log.timestamp).toLocaleString('zh-CN') }}</span>
              <span class="log-duration mono">{{ formatDuration(log.duration) }}</span>
              <span class="log-expand-icon">{{ expandedLogIndex === i ? '▾' : '▸' }}</span>
            </div>
            <div v-if="expandedLogIndex === i && log.output" class="log-output mono">{{ log.output }}</div>
            <div v-if="expandedLogIndex === i && !log.output" class="log-output mono log-output-empty">无详细日志</div>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" @click="logsModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-modal {
  min-width: 560px;
}

.fieldset {
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 20px;
}

.fieldset legend {
  padding: 0 8px;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--text-primary);
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  accent-color: var(--accent);
}

.logs-modal {
  min-width: 560px;
}

.logs-list {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.log-entry {
  border-radius: var(--radius);
  background: var(--bg-input);
  border-left: 3px solid var(--border-color);
  overflow: hidden;
  min-height: 42px;
  flex-shrink: 0;
}

.log-success { border-left-color: var(--success); }
.log-failed { border-left-color: var(--danger); }

.log-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
}

.log-header:hover {
  background: var(--bg-tertiary);
}

.log-status {
  font-weight: 700;
  flex-shrink: 0;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
}

.log-success .log-status { color: var(--success); }
.log-failed .log-status { color: var(--danger); }

.log-message-brief {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-time {
  color: var(--text-secondary);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.log-duration {
  color: var(--text-muted);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.log-expand-icon {
  color: var(--text-muted);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.log-output {
  padding: 8px 12px 10px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-all;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.log-output-empty {
  color: var(--text-muted);
  font-style: italic;
}
</style>
