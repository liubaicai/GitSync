<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { Source, SyncTask } from '@/types'
import { tasksApi, sourcesApi } from '@/api'

const router = useRouter()
const route = useRoute()
const isEdit = computed(() => !!route.params.id)

const sources = ref<Source[]>([])
const loading = ref(false)
const saving = ref(false)

const form = ref({
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

onMounted(async () => {
  try {
    sources.value = await sourcesApi.list()
  } catch { /* ignore */ }

  if (isEdit.value) {
    loading.value = true
    try {
      const tasks = await tasksApi.list()
      const task = tasks.find(t => t.id === route.params.id)
      if (task) {
        form.value.name = task.name
        form.value.sourceRepo = { ...task.sourceRepo }
        form.value.targetRepo = { ...task.targetRepo }
        form.value.schedule = { ...task.schedule }
        // Set cron preset
        const preset = cronPresets.find(p => p.value === task.schedule.cron)
        if (preset) {
          selectedCronPreset.value = preset.value
        } else {
          selectedCronPreset.value = 'custom'
          customCron.value = task.schedule.cron
        }
      }
    } catch { /* ignore */ }
    loading.value = false
  }
})

async function handleSubmit() {
  if (!form.value.name || !form.value.sourceRepo.repoUrl || !form.value.targetRepo.repoUrl) {
    alert('请填写任务名称和仓库地址')
    return
  }

  if (selectedCronPreset.value === 'custom' && form.value.schedule.enabled) {
    form.value.schedule.cron = customCron.value
  }

  saving.value = true
  try {
    if (isEdit.value) {
      await tasksApi.update(route.params.id as string, form.value)
    } else {
      await tasksApi.create(form.value)
    }
    router.push('/')
  } catch (e: unknown) {
    alert(`保存失败: ${e instanceof Error ? e.message : e}`)
  } finally {
    saving.value = false
  }
}

function onSourceSelect(side: 'source' | 'target') {
  const field = side === 'source' ? form.value.sourceRepo : form.value.targetRepo
  const src = sources.value.find(s => s.id === field.sourceId)
  if (src) {
    field.authType = src.authType
  }
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ isEdit ? '编辑任务' : '新增同步任务' }}</h1>
    </div>

    <div v-if="loading" class="empty-state">加载中...</div>
    <form v-else class="card task-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>任务名称</label>
        <input v-model="form.name" placeholder="例如：my-project 同步" />
      </div>

      <!-- Source Repo -->
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
          <input v-model="form.sourceRepo.repoUrl" placeholder="https://github.com/user/repo.git 或 git@github.com:user/repo.git" class="mono" />
        </div>
        <div class="form-group">
          <label>认证方式</label>
          <select v-model="form.sourceRepo.authType">
            <option value="https">HTTPS</option>
            <option value="ssh">SSH</option>
          </select>
        </div>
      </fieldset>

      <!-- Target Repo -->
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
          <input v-model="form.targetRepo.repoUrl" placeholder="https://gitlab.com/user/repo.git 或 git@gitlab.com:user/repo.git" class="mono" />
        </div>
        <div class="form-group">
          <label>认证方式</label>
          <select v-model="form.targetRepo.authType">
            <option value="https">HTTPS</option>
            <option value="ssh">SSH</option>
          </select>
        </div>
      </fieldset>

      <!-- Schedule -->
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
        <button type="button" class="btn btn-secondary" @click="router.push('/')">取消</button>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? '保存中...' : (isEdit ? '保存修改' : '创建任务') }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.task-form {
  max-width: 720px;
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
</style>
