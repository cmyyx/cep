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

> 手动推送 tag 也会触发部署：
>
> ```bash
> # 普通部署
> git tag -a v0.2.0 -m "v0.2.0" && git push origin v0.2.0
>
> # 强制更新（tag 名以 -force 结尾）
> git tag -a v0.2.0-force -m "v0.2.0-force" && git push origin v0.2.0-force
> ```

Tag 命名格式: `v<major>.<minor>.<patch>`。前两位表示适配的游戏版本，patch 位手动递增。

### 2. 推送后发生了什么

1. GitHub Actions `deploy.yml` 被触发
2. 拉取完整 git 历史（`fetch-depth: 0`），确保更新日志不缺失
3. 从触发上下文（`github.ref_name` 或 `inputs.version`）提取 tag 名称作为版本号
4. 如果是 `workflow_dispatch` 且勾选了 `force`：创建轻量级 `force-N` tag 并推送
5. 运行 `prebuild`（生成 `version.json` + `version-data.ts`，注入 `DEPLOY_TAG` 环境变量；`forceUpgradeSerial` 由统计本地 `force-*` tag 数量得出）
6. 运行 `next build`（SSG 静态导出到 `out/`）
7. 将 `out/` 内容写入部署分支的 `public/`，强制推送到 `deploy-cn` / `deploy-intl`
8. Cloudflare Pages 从对应部署分支读取，站点根目录为 `public/`

`deploy-*` 分支不保留历史，每次强制覆盖。部署分支布局为 `public/` 下的静态站点文件，而不是分支根目录直接铺站。

---

## 强制升级

### 用途

当版本包含**严重 BUG 修复**或**破坏性变更**时，可标记为强制升级。用户浏览器检测到强制升级后，会弹出无法跳过的对话框，要求立即刷新页面。

### 如何标记

**通过 `workflow_dispatch` 或手动推送 `-force` 后缀 tag**：

| 方式 | 操作 |
|------|------|
| workflow_dispatch | 填写 version，勾选 `force` 复选框 |
| 手动推送 | `git tag -a v0.2.1-force -m "..." && git push origin v0.2.1-force` |

Tag 名以 `-force` 结尾时，workflow 自动创建 `force-N` 轻量级标记。

> 手动推送的普通 tag（不以 `-force` 结尾）会被正常部署，但不会触发强制更新序列号递增。

### 工作原理

1. 仓库中维护一个轻量级 tag `force-N`，N 为当前强制更新序号
2. 每次强制部署时，workflow 删除旧的 `force-N`，创建新的 `force-(N+1)`
3. `generate-version.mjs` 读取 `force-N` tag 名中的数字作为 `forceUpgradeSerial`
4. 前端 `use-version.tsx` 轮询发现新版本后，比较 `localInfo.forceUpgradeSerial` 与 `info.forceUpgradeSerial`
5. 两者不相等 → 弹出强制刷新对话框
6. 用户刷新后，页面加载最新版本，`localInfo` 与 `info` 一致 → 不再弹窗

### 跨版本保护

如果用户跳过了多个版本（例如本地 v0.1.1 → 云端 v0.1.3），只要其中任何一个中间版本有 force 标记（`force-N` tag），`forceUpgradeSerial` 就会不同，强制刷新仍会触发。

| 本地版本 | 云端版本 | localSerial | remoteSerial | 弹窗? |
|---------|---------|:-----------:|:------------:|:-----:|
| v0.1.1 | v0.1.2（force #1） | 0 | 1 | 是 |
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
