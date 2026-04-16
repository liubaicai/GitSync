<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { path: '/', label: '~/sync', icon: '' },
  { path: '/sources', label: '~/sources', icon: '' },
  { path: '/ssh-keys', label: '~/keys', icon: '' },
]
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="container header-inner">
        <router-link to="/" class="logo">
          <span class="logo-icon">#</span>
          <span class="logo-text">GitSync_</span>
        </router-link>
        <nav class="nav">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: route.path === item.path }"
          >
            <span v-if="item.icon" class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </router-link>
        </nav>
      </div>
    </header>
    <main class="app-main">
      <div class="container">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: var(--text-primary);
  border-bottom: 2px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.05);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--bg-primary);
  font-weight: 700;
  font-size: 1.25rem;
  font-family: var(--font-mono);
  letter-spacing: -0.5px;
  text-decoration: none;
}

.logo-icon {
  color: var(--success);
}

.logo-text {
  animation: blink 2s infinite;
}

@keyframes blink {
  0%, 100% { border-right: 2px solid transparent; }
  50% { border-right: 2px solid var(--success); }
}

.nav {
  display: flex;
  gap: 16px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid transparent;
  color: #9ca3af;
  font-size: 0.9rem;
  font-family: var(--font-mono);
  text-decoration: none;
  transition: all var(--transition);
}

.nav-item:hover {
  color: #fff;
  border-bottom: 1px solid #fff;
}

.nav-item.active {
  color: var(--success);
  border-bottom: 1px solid var(--success);
  background: rgba(16, 185, 129, 0.1);
}

.nav-icon {
  font-size: 1rem;
}

.app-main {
  flex: 1;
  padding: 40px 0;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
