<script setup lang="ts">
defineProps<{
  status: 'idle' | 'running' | 'success' | 'failed'
}>()

const labels: Record<string, string> = {
  idle: '空闲',
  running: '同步中',
  success: '成功',
  failed: '失败',
}
</script>

<template>
  <span class="badge" :class="`badge-${status}`">
    <span v-if="status === 'running'" class="dot-pulse" />
    [{{ labels[status] }}]
  </span>
</template>

<style scoped>
.badge {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 1px;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid currentColor;
  background: var(--bg-card);
}

.badge-idle {
  color: var(--text-secondary);
}

.badge-running {
  color: var(--success);
  box-shadow: 2px 2px 0px rgba(16, 185, 129, 0.2);
}

.badge-success {
  color: var(--success);
}

.badge-failed {
  color: var(--danger);
  box-shadow: 2px 2px 0px rgba(239, 68, 68, 0.2);
}

.dot-pulse {
  width: 6px;
  height: 6px;
  border-radius: 0;
  background: currentColor;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}
</style>
