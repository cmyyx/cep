# 发布与部署指南

## 发布流程

本项目使用 **Git Tag** 触发自动构建和部署。

### 1. 创建发布 Tag

通过 GitHub Actions 手动触发：

**Actions → Deploy → Run workflow**，填写：

| 字段 | 示例 | 说明 |
|------|------|------|
| `version` | `v0.2.0` | Tag 名称，格式 `vX.Y.Z` |
| `force` | `true` / `false` | 是否强制更新（勾选复选框） |

> 也可以手动打 tag 推送：`git tag -a v0.2.0 -m "v0.2.0" && git push origin v0.2.0`，但强制更新只能通过 `workflow_dispatch` 勾选 `force` 复选框触发。

Tag 命名格式: `v<major>.<minor>.<patch>`。前两位表示适配的游戏版本，patch 位手动递增。

### 2. 推送后发生了什么

1. GitHub Actions `deploy.yml` 被触发
2. 拉取完整 git 历史（`fetch-depth: 0`），确保更新日志不缺失
3. 从触发上下文（`github.ref_name` 或 `inputs.version`）提取 tag 名称作为版本号
4. 从仓库 Variable `FORCE_UPGRADE_SERIAL` 读取当前强制更新序列号，若 `force` 勾选则 +1
5. 运行 `prebuild`（生成 `version.json` + `version-data.ts`，注入 `DEPLOY_TAG` 和 `FORCE_UPGRADE_SERIAL` 环境变量）
6. 运行 `next build`（SSG 静态导出到 `out/`）
7. 如果是强制更新：`gh variable set FORCE_UPGRADE_SERIAL` 持久化新序列号
8. 将 `out/` 内容强制推送到 `deploy` 分支
9. Cloudflare Pages 自动从 `deploy` 分支部署

`deploy` 分支不保留历史，每次强制覆盖。

---

## 强制升级

> **一次性设置**：在仓库 **Settings → Variables** 中创建 `FORCE_UPGRADE_SERIAL`，值设为 `0`。

### 用途

当版本包含**严重 BUG 修复**或**破坏性变更**时，可标记为强制升级。用户浏览器检测到强制升级后，会弹出无法跳过的对话框，要求立即刷新页面。

### 如何标记

**强制更新统一通过 `workflow_dispatch` 触发**，勾选 `force` 复选框：

1. 打开仓库 **Actions → Deploy → Run workflow**
2. `version`：填写版本号（如 `v0.2.1`）
3. `force`：勾选复选框

> 手动推送的 tag 会被正常部署，但不会触发强制更新序列号递增。

### 工作原理

1. 仓库 **Settings → Variables** 中维护一个 `FORCE_UPGRADE_SERIAL` 变量（初始值 `0`），作为强制更新的单调递增计数器
2. 构建时，根据 `force` 复选框是否勾选决定序列号是否 +1
3. 构建成功后，`deploy.yml` 自动调用 `gh variable set` 将新序列号持久化到仓库
4. 前端 `use-version.tsx` 轮询发现新版本后，比较 `localInfo.forceUpgradeSerial` 与 `info.forceUpgradeSerial`
5. 两者不相等 → 弹出强制刷新对话框
6. 用户刷新后，页面加载最新版本，`localInfo` 与 `info` 一致 → 不再弹窗

### 跨版本保护

如果用户跳过了多个版本（例如本地 v0.1.1 → 云端 v0.1.3），只要其中任何一个中间版本有 `[force]` 标记，`forceUpgradeSerial` 就会不同，强制刷新仍会触发。

| 本地版本 | 云端版本 | localSerial | remoteSerial | 弹窗? |
|---------|---------|:-----------:|:------------:|:-----:|
| v0.1.1 | v0.1.2 `[force]` | 0 | 1 | 是 |
| v0.1.1 | v0.1.3（无 force） | 0 | **1** | **是**（1 !== 0） |
| v0.1.2 | v0.1.3（无 force） | 1 | 1 | 否 |

### 不需要 localStorage

比较基于 `localInfo`（构建时嵌入 JS bundle 的数据）和 `info`（轮询 `version.json` 的数据），无需客户端存储。刷新后 `localInfo` 已更新，比较自然相等。

---

## CI 检查

每次推送到 `main` 分支自动运行:

1. `npx tsc --noEmit` — TypeScript 类型检查
2. `npm run lint` — ESLint
3. `npm test` — 测试套件
4. `npm run build` — 验证可构建

CI 不会部署，仅做质量门禁。

---

## 版本号说明

版本号格式: `{major}.{minor}.{patch}-{commitHash}`

- `major.minor` — 适配的游戏版本（如 `1.2`）
- `patch` — 手动递增的修订号
- `commitHash` — git short hash（7 位），自动附加

版本号**从 git tag 名称提取**（如 tag `v1.2.0` → semver `1.2.0`），不再依赖 `package.json` 中的 version 字段。本地开发无 tag 时 fallback 到 `package.json`。

示例: `1.2.0-ea87444`
