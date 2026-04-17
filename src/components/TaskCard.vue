<script setup lang="ts">
import type { SyncTask } from '@/types'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{
  task: SyncTask
}>()

const emit = defineEmits<{
  sync: [id: string]
  edit: [id: string]
  delete: [id: string]
  logs: [id: string]
}>()

function platformIcon(url: string): string {
  if (url.includes('github')) return '⬡'
  if (url.includes('gitlab')) return '◆'
  if (url.includes('gitea')) return '◈'
  return '◇'
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname.replace(/^\//, '').replace(/\.git$/, '')
  } catch {
    return url.replace(/\.git$/, '')
  }
}

function cronLabel(cron: string): string {
  const presets: Record<string, string> = {
    '0 * * * *': '每小时',
    '0 */6 * * *': '每 6 小时',
    '0 0 * * *': '每天',
    '0 0 * * 0': '每周',
  }
  return presets[cron] || cron
}

function timeAgo(iso?: string): string {
  if (!iso) return '从未'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}
</script>

<template>
  <div class="card task-card">
    <div class="task-row">
      <div class="task-header">
        <div class="task-name">{{ task.name }}</div>
      </div>
      <div class="task-repos">
        <div class="repo-endpoint">
          <span class="repo-icon">{{ platformIcon(task.sourceRepo.repoUrl) }}</span>
          <span class="repo-url mono">{{ shortenUrl(task.sourceRepo.repoUrl) }}</span>
          <span class="auth-tag">{{ task.sourceRepo.authType.toUpperCase() }}</span>
        </div>
        <span class="arrow">→</span>
        <div class="repo-endpoint">
          <span class="repo-icon">{{ platformIcon(task.targetRepo.repoUrl) }}</span>
          <span class="repo-url mono">{{ shortenUrl(task.targetRepo.repoUrl) }}</span>
          <span class="auth-tag">{{ task.targetRepo.authType.toUpperCase() }}</span>
        </div>
      </div>
      <StatusBadge :status="task.status" class="task-status" />
    </div>

    <div v-if="task.lastError && task.status === 'failed'" class="task-error mono">
      {{ task.lastError }}
    </div>

    <div class="task-row">
      <div class="task-meta">
        <span v-if="task.schedule.enabled" class="meta-item">
          ⏱ {{ cronLabel(task.schedule.cron) }}
        </span>
        <span v-else class="meta-item meta-disabled">⏱ 未启用定时</span>
        <span class="meta-item">
          最后同步: {{ timeAgo(task.lastSyncAt) }}
        </span>
      </div>
      <div class="task-actions">
        <button class="btn btn-ghost btn-sm" style="color: var(--danger)" @click="emit('delete', task.id)">删除</button>
        <button class="btn btn-ghost btn-sm" @click="emit('edit', task.id)">编辑</button>
        <button class="btn btn-ghost btn-sm" @click="emit('logs', task.id)">记录</button>
        <button
          class="btn btn-primary btn-sm"
          :disabled="task.status === 'running'"
          @click="emit('sync', task.id)"
        >
          ▶ 立即同步
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  overflow: hidden;
}

.task-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--text-muted);
}

.task-card:hover::before {
  background: var(--text-primary);
}

.task-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-left: 8px;
  flex-wrap: wrap;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.task-name {
  font-weight: 700;
  font-size: 1.05rem;
  font-family: var(--font-mono);
  white-space: nowrap;
}

.task-repos {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.task-status {
  margin-left: auto;
  flex-shrink: 0;
}

.repo-endpoint {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-primary);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  min-width: 0;
  font-family: var(--font-mono);
}

.repo-icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: var(--text-secondary);
}

.repo-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 0.9em;
}

.auth-tag {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-primary);
  background: var(--border-color);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  letter-spacing: 1px;
}

.arrow {
  color: var(--text-muted);
  font-weight: 700;
  font-size: 1.2rem;
  font-family: var(--font-mono);
}

.task-meta {
  display: flex;
  gap: 20px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  flex: 1;
  min-width: 0;
}

.meta-disabled {
  color: var(--text-muted);
  opacity: 0.6;
}

.task-error {
  background: var(--bg-primary);
  color: var(--danger);
  padding: 12px;
  border-left: 3px solid var(--danger);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  max-height: 80px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: var(--font-mono);
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.task-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
