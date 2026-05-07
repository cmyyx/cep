# 发布与部署指南

## 发布流程

本项目使用 **Git Tag** 触发自动构建和部署。

### 1. 创建发布 Tag

```bash
git tag -a v0.2.0 -m "版本描述"
git push origin v0.2.0
```

Tag 命名格式: `v<major>.<minor>.<patch>`，与 `package.json` 的 version 字段保持一致（前两位表示适配的游戏版本，patch 位手动递增）。

### 2. 推送后发生了什么

1. GitHub Actions `deploy.yml` 被触发
2. 拉取完整 git 历史（`fetch-depth: 0`），确保更新日志不缺失
3. 运行 `prebuild`（生成 `version.json` + `version-data.ts`）
4. 运行 `next build`（SSG 静态导出到 `out/`）
5. 将 `out/` 内容强制推送到 `deploy` 分支
6. Cloudflare Pages 自动从 `deploy` 分支部署

`deploy` 分支不保留历史，每次强制覆盖。

---

## 强制升级

### 用途

当版本包含**严重 BUG 修复**或**破坏性变更**时，可标记为强制升级。用户浏览器检测到强制升级后，会弹出无法跳过的对话框，要求立即刷新页面。

### 如何标记

在 tag message 中加入 `[force]`：

```bash
git tag -a v0.2.1 -m "修复数据丢失的严重BUG [force]"
git push origin v0.2.1
```

`[force]` 放在 tag message 的任意位置均可。

### 工作原理

1. 构建时 `generate-version.mjs` 统计历史中所有含 `[force]` 的 tag 数量，写入 `version.json` 的 `forceUpgradeSerial` 字段
2. 前端 `use-version.tsx` 轮询发现新版本后，比较 `localInfo.forceUpgradeSerial` 与 `info.forceUpgradeSerial`
3. 两者不相等 → 弹出强制刷新对话框
4. 用户刷新后，页面加载最新版本，`localInfo` 与 `info` 一致 → 不再弹窗

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

版本号格式: `{gameMajor}.{gameMinor}.{patch}-{commitHash}`

- `gameMajor.gameMinor` — 适配的游戏版本（如 `0.1`）
- `patch` — 手动递增的修订号，在 `package.json` 中修改
- `commitHash` — git short hash（7 位），自动附加

示例: `0.1.0-bc668f5`
