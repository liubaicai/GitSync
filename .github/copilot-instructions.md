# GitSync — Copilot 工作区指引

## 项目概要

Git 仓库镜像同步平台。前后端同仓：Vue 3 前端 (`src/`) + Express 后端 (`server/`)，TypeScript 全栈，JSON 文件存储，无数据库。

## 构建与运行

```bash
npm run dev            # 并发启动前端(3000) + 后端(3001)
npm run build          # 构建前端(Vite) + 后端(tsup) → dist/
npx vite build         # 仅验证前端构建
npx tsc --noEmit       # 全量类型检查
```

暂无测试框架——需要时优先选 Vitest。

## 架构

- **后端** `server/`：Express REST API，路由在 `routes/`，业务在 `services/`
  - 核心同步：`git clone --mirror` → `git push --force --prune`（见 `services/git-sync.ts`）
  - 定时调度：node-cron（`services/scheduler.ts`）
  - 数据持久化：JSON 文件读写（`services/storage.ts` → `data/` 目录）
- **前端** `src/`：Vue 3 SPA，Vite 构建，开发时 `/api` 代理到后端
- **类型**：前后端各自维护类型（`server/types.ts`、`src/types/index.ts`），字段定义保持同步

## 代码约定

### TypeScript
- 严格模式，ES2022 目标
- 前端路径别名 `@/*` → `src/*`

### Vue 组件
- **必须使用** Composition API + `<script setup lang="ts">`
- Props 用 `defineProps<{}>()` 类型声明，Emits 用 `defineEmits<{}>()`
- 样式用 `<style scoped>`，组件文件 PascalCase

### 后端路由
- RESTful：GET 列表、POST 创建、PUT 更新、DELETE 删除
- 全部 async/await，错误返回 `{ error: string }` + 对应 HTTP 状态码
- 敏感字段（token、私钥路径）在 API 响应中脱敏

### 样式
- 全局 CSS 变量定义在 `src/styles/global.css`，浅色默认主题
- 圆角 2-4px（锐利风格），避免过度圆滑
- 新增组件样式用 scoped CSS + 已有变量，不要引入新色值

## 注意事项

- `data/`、`tmp/`、`dist/` 已在 `.gitignore`，运行时自动创建
- Git 必须预装在运行环境中
- 修改数据模型时需同步更新前后端两份类型定义
- 同步任务通过 `child_process.exec` 调用 git，执行超时 10 分钟
