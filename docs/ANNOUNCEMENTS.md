# 公告系统

## 文件结构

```
public/announcements/
├── index.json              ← 手写元数据（git tracked）
├── index.generated.json    ← 构建时自动生成（git ignored）
├── YYYY-MM-DD-NNN.md       ← 公告正文（Markdown）
└── *.jpg / *.png           ← 内嵌图片
```

## 新增公告

1. 在 `public/announcements/` 下创建 `.md` 文件，命名格式 `YYYY-MM-DD-NNN.md`
2. 在 `index.json` 中添加条目：

```json
{
  "id": "announce-YYYY-MM-DD-NNN",
  "title": "公告标题",
  "file": "YYYY-MM-DD-NNN.md",
  "priority": "normal"
}
```

3. `git add` + `git commit`
4. 构建时 `scripts/generate-announcement-meta.mjs` 自动从 git 历史填充 `publishTime` 和 `updatedTime`

## 时间字段自动生成

| 字段 | 来源 | 优先级 |
|------|------|--------|
| `publishTime` | git 首次提交时间（`--diff-filter=A --follow`） | 1. git → 2. index.json → 3. fs birthtime → 4. fs mtime |
| `updatedTime` | git 最后一次提交时间（`log -1`） | 1. git → 2. fs mtime → 3. 留空 |

- **git 不可用时**（如 ZIP 下载），fallback 到 `index.json` 中的手写值和文件系统时间
- **`updatedTime` 仅在内容实际被修改后更新**，与 `publishTime` 相同时不写入生成文件
- `publishTime` 与 `updatedTime` 完全自动生成，**无需手动填写**

## index.json 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 唯一标识，格式 `announce-YYYY-MM-DD-NNN` |
| `title` | 是 | 公告标题 |
| `file` | 二选一 | 指向 `.md` 文件的相对路径 |
| `content` | 二选一 | 内联 Markdown 内容（仅简单公告，不推荐） |
| `priority` | 是 | `"normal"` 或 `"important"` |
| `publishTime` | 否 | 手动覆盖值（**仅在 git 不可用时作为 fallback**） |

- `file` 和 `content` 不能同时为空
- `file` 存在时，`.md` 内容优先于 `content`
- 推荐使用 `file` 引用，便于内容修订和历史追踪

## 内嵌图片

在 `.md` 中引用图片时使用站点根路径：

```markdown
![图片描述](/announcements/example.jpg)
```

`validate-announcements.mjs` 在 prebuild 时校验图片路径是否可解析（P0 阻断构建），`generate-announcement-meta.mjs` 校验 `.md` 文件是否存在（P0 阻断构建）。

## 内容格式

公告正文为标准 Markdown，支持：

| 元素 | 支持 |
|------|------|
| 标题 (h2, h3) | 是 |
| 段落 | 是 |
| 列表 (ul, ol) | 是 |
| 链接 | 是 |
| 粗体 / 斜体 | 是 |
| 图片 | 是（支持点击放大灯箱） |
| 代码 / 代码块 | 是 |
| 引用 | 是 |

图片点击会弹出全屏灯箱，Esc 关闭。

## 优先级

| 值 | 行为 |
|------|------|
| `"important"` | 公告面板顶部显示，首页顶部显示未读横幅，列表中有 amber 标记 |
| `"normal"` | 普通公告，排在 important 之后 |

## prebuild 链路

```text
generate-og.mjs
  → generate-seo.mjs
    → generate-version.mjs
      → generate-characters-index.mjs
        → generate-announcement-meta.mjs   ← 自动填充时间
          → validate-announcements.mjs     ← 校验文件完整性和图片引用
            → check-i18n.mjs
```

两个公告脚本相互独立：`generate` 负责时间自动化，`validate` 负责完整性校验。

## 已读状态

- 用户点击公告 → 标记为已读
- 已读 ID 持久化到 localStorage（`cep-announcement-read-ids`）
- 首页公告面板显示未读计数徽章
- `"important"` 公告未读时，首页顶部显示 amber 横幅
