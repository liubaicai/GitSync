<div align="center">

# GitSync

**Git 仓库镜像同步平台**

在不同 Git 平台之间自动镜像同步仓库，支持 GitHub、GitLab、Gitea 等。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 功能特性

- **完整镜像同步** — 基于 `git clone --mirror` + `git push --force --prune`，同步所有分支、标签和引用
- **多平台支持** — 预配置 GitHub、GitLab、Gitea，也可自定义任意 Git 平台
- **双协议** — 支持 HTTPS（Token 认证）和 SSH（密钥认证）两种方式
- **定时同步** — 基于 Cron 表达式的定时任务调度，支持自定义频率
- **SSH 密钥管理** — 在线生成或导入 SSH 密钥对，一键复制公钥
- **零数据库依赖** — 所有配置和日志以 JSON 文件存储，部署简单
- **同步日志** — 记录每次同步的结果、耗时和错误信息

## 快速开始

### 前置要求

- **Node.js** >= 18
- **Git** >= 2.20
- **ssh-keygen**（如需在线生成密钥）

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务（前端 :3000 + 后端 :3001）
npm run dev
```

浏览器打开 `http://localhost:3000`。

### 生产构建

```bash
# 构建前端 + 后端
npm run build

# 启动服务
npm start
```

服务默认运行在 `http://localhost:3001`，通过环境变量 `PORT` 修改端口。

### Docker

```bash
# 构建镜像
docker build -t gitsync .

# 运行容器
docker run -d \
  -p 3001:3001 \
  -v gitsync-data:/app/data \
  --name gitsync \
  gitsync
```

数据持久化挂载 `/app/data` 即可保留所有配置、密钥和日志。

## 使用指南

### 1. 配置数据源

进入「数据源」页面，添加你常用的 Git 平台：

| 字段 | 说明 |
|------|------|
| 平台类型 | GitHub / GitLab / Gitea / 自定义 |
| 平台地址 | 如 `https://github.com` |
| 认证方式 | HTTPS（填写 Token）或 SSH（选择密钥） |

### 2. 管理 SSH 密钥

进入「SSH 密钥」页面，可以：
- 自动生成 RSA 4096 位密钥对
- 手动导入已有密钥
- 一键复制公钥，添加到目标平台

### 3. 创建同步任务

进入「同步任务」页面，点击「新增任务」：
- 分别配置源仓库和目标仓库（可选择已有数据源或手动输入地址）
- 设置同步频率（每小时 / 每 6 小时 / 每天 / 自定义 Cron）
- 支持手动触发立即同步

## 项目结构

```
├── server/                 # Express 后端
│   ├── routes/             #   API 路由
│   ├── services/           #   核心服务（同步、调度、存储）
│   └── types.ts            #   类型定义
├── src/                    # Vue 3 前端
│   ├── views/              #   页面
│   ├── components/         #   组件
│   ├── api/                #   API 调用层
│   └── styles/             #   全局样式
├── data/                   # 运行时数据（自动创建）
└── tmp/                    # 同步临时目录（自动创建）
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite |
| 后端 | Express + TypeScript |
| 定时任务 | node-cron |
| 数据存储 | JSON 文件 |
| Git 操作 | child_process 调用系统 git |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 服务监听端口 |

## License

[MIT](LICENSE)
