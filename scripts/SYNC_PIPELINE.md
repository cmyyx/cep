# Game Data Sync Pipeline

将上游仓库（AKEData、AKEDatabase）的游戏数据同步到项目，生成多语言 i18n 文件和图标。多语言翻译直接取自 `AKEData/TableCfg/I18nTextTable_*.json`。

## 上游数据源

| 仓库 | 用途 | 路径示例 |
|------|------|---------|
| [AKEData](https://github.com/cmyyx/AKEData) (fork) | 武器/装备/角色/副本条目 + 属性数据 + 多语言翻译（TableCfg/I18nTextTable_*.json） | `output/CN/weapon/`, `TableCfg/` |
| [AKEDatabase](https://github.com/NagiYume/AKEDatabase) | 属性映射 maps.json | `public/*/maps.json` |

## 环境准备

### 本地配置

在项目根目录创建 `sync-game-data.config.json`（已 gitignore）：

```json
{
  "akedataPath": "D:/GitHub/AKEData",
  "imagedbPath": "D:/GitHub/AKEDatabase"
}
```

如果上游仓库尚未 clone，脚本会使用默认路径 `../upstream/AKEData` 等（项目目录外，避免 submodule 污染）。可通过 CLI 参数覆盖：

```bash
pnpm sync:check --local \
  --akedata D:/GitHub/AKEData \
  --imagedb D:/GitHub/AKEDatabase
```

## CLI 命令

```bash
# 检查模式：仅输出差异报告，不修改任何文件
pnpm sync:check [--local]

# 更新模式：生成 i18n 文件 + 转换图标
pnpm sync:update [--local]
```

- `--local`：跳过 SHA 分支检查，直接使用本地文件路径
- 不加 `--local`：CI 模式，比较 SHA 后决定是否执行

## 生成文件结构

```text
src/generated/i18n/
├── weapons/
│   ├── zh-CN.json     ← CN: output/CN weapon title
│   ├── en.json        ← EN: TextTable_EN[engName.id]
│   ├── ja.json        ← JP: TextTable_JP[engName.id]
│   └── zh-TW.json      ← TC: TextTable_TC[engName.id]
├── equips/
│   ├── zh-CN.json      ← CN: output/CN equip name（≥5★）
│   ├── en.json         ← 同上（等待 TextTable 映射）
│   ├── ja.json
│   └── zh-TW.json
├── dungeons/
│   ├── zh-CN.json      ← "四号谷地·枢纽区"（从 region i18n 拼接）
│   ├── en.json         ← "Valley IV·The Hub"
│   ├── ja.json
│   └── zh-TW.json
├── stats/
│   ├── zh-CN.json      ← 词条翻译（武器 primaryStat/elementalDamage/specialAbility）
│   ├── en.json
│   ├── ja.json
│   └── zh-TW.json
└── regions/
    ├── zh-CN.json       ← 四号谷地/武陵/枢纽区...
    ├── en.json          ← Valley IV/Wuling/The Hub...
    ├── ja.json
    └── zh-TW.json
```

### 文件格式

每个文件是 JSON 对象，key 为游戏 ID，value 为对应语言的翻译文本：

```json
{
  "wpn_claym_0003": "工业零点一",
  "wpn_claym_0004": "典范",
  "wpn_funnel_0017": "雾中微光"
}
```

## 如何在前端使用

### 1. 分层注入（Client vs Server）

同步产物仍是全量 generated JSON；**运行时不得把 wikiData 塞进根 layout 的 ClientProvider**（静态导出会把 messages 复制进每个页面 HTML）。

| API | 用途 | 是否含 wikiData |
|-----|------|-----------------|
| `loadClientMessages(locale)` | 根 layout `NextIntlClientProvider` | 否（UI + 规划器用短名表） |
| `loadMessages(locale)` | `getRequestConfig` / 服务端 `getTranslations`（SSG） | 是 |
| `@/lib/game-i18n-catalogs` | 客户端 wiki 长文案 / 实体名（`import()` **按 locale 动态分包** + 缓存；layout 预加载当前语言） | wikiData 在此 |

```tsx
// 规划器短名：仍走 next-intl（已在 ClientProvider）
t('weapons.wpn_funnel_0017')

// 地区名（namespace 为 region）
t('region.fourthValley')

// Wiki 长文案 / 技能描述：useWikiTranslations() 或 game-i18n-catalogs
// 不要 useTranslations('wikiData')
```

### 2. 数据映射辅助

`src/data/region-i18n.ts` 提供原始中文名 → i18n key 的映射：

```ts
import { regionI18nKey } from '@/data/region-i18n'

const key = regionI18nKey('四号谷地')  // → 'regions.fourthValley'
t(key)                                  // → "四号谷地" / "Valley IV"
```

### 3. 游戏中使用的原始 ID

当前项目的 `src/data/` 文件中，游戏内容的 ID 字段使用 AKEData 官方 ID：

| 数据文件 | ID 来源 |
|---------|--------|
| `weapons.ts` 的 `imageId` | `WeaponBasicTable.json` 的 key（如 `wpn_funnel_0017`） |
| `equips.ts` 的 `id` | `EquipTable.json` 的 key（如 `item_equip_t4_suit_atb01_body_01`） |
| `dungeons.ts` 的 `id` | `DungeonTable.json` 的 key（如 `dung_wuling_01`） |

## SHA 追踪

SHA 追踪信息存储在主仓库文件 `scripts/.cache/upstream-versions.json` 中（随主分支提交）：

```json
{
  "akedata": "abc123...",
  "imagedb": "def456...",
  "lastSync": "2026-06-07T00:00:00.000Z"
}
```

### 更新判定（四道闸门，全过才跳过）

`pnpm sync:check` 只有在**两个 SHA 都相同**时才进入本地一致性校验，任一 SHA 不同直接判定"有变更"：

1. AKEData HEAD SHA == `scripts/.cache/upstream-versions.json`
2. AKEDatabase HEAD SHA == 同上
3. 本地一致性：`validateAllData`（武器/装备/淤积点 + 来源关系）、武器 iconId、`validateImages`、
   `validateCharacterAvatarMappings`（banner 引用的角色名是否都能解析出头像）
4. Skland 目录探针（仅 `--check --skland-probe`，CI 的 check job 会带上）：对比线上干员目录与已提交的
   `preview-character-avatars.json` / `sources.json`，命中两类漂移即判定需要更新：
   出现未抓取的前瞻角色、前瞻头像 URL 变了

任一不过 → `exit 2`（`changed=true`）→ 跑 `sync:update`；全过 → `exit 0` → sync job 被跳过。

**为什么需要第 4 道**：Skland 既不在 AKEData 也不在 AKEDatabase 里（其 API 还需要浏览器内签名的
`timestamp`/`sign` 请求），所以第 1-3 道看不见"维基上新出现一个前瞻角色"。没有第 4 道时，只能靠人工
`force_sync` 或等该角色进游戏数据（SHA 变化）才会刷新头像。第 3 道仍然必要：它负责"本地/分支引用了
没有映射的角色名"（此时 Skland 可能本来就没有这个名字），失败信息是明确的
`[banner] 祀`，而不是 CI 里 4 个测试文件报 `Missing character avatar mapping`。

**第 4 道失败即忽略**：浏览器缺失、网络错误、Skland 改版都返回 `probeError` 并按"无变化"处理，只打
warning —— 不让维基挂掉把数据同步整条卡死。

- `pnpm sync:update` 成功后同时更新两个 SHA（通过 PR 提交到目标分支）
- 头像抓取新增硬校验：抓取后 `downloadCharacterAvatars` 返回的 `missing` 非空（对比本次生成的
  Wiki 资源清单）→ 直接 `exit 1`，不开注定过不了 CI 的 PR。抓取失败被跳过时，`missing` 按
  已有目录计算，因此"保留旧头像"不会掩盖新角色缺图

## CI 工作流

`.github/workflows/sync-game-data.yml`：

- **触发**：每周四、周五 00:00 UTC（cron `0 0 * * 4,5`）+ 手动 dispatch
- **Check 阶段**：shallow sparse clone 上游仓库（仅需的目录），比较 SHA + 本地一致性（含角色头像映射）+ Skland 目录探针（需要 chromium）
- **Sync 阶段**：有变更时运行 `sync:update`，自动创建 PR 到**触发它的那个分支**
- **手动强制**：dispatch 时勾选 `force_sync` → 跳过变更闸门直接跑 `sync:update`
  （上游 SHA 没动但头像/映射过期时的唯一入口）
- **PR 分支命名**：`base = 触发分支`，head 分支 `auto/sync-game-data-<触发分支>`，
  因此不同分支的 sync 不会互相 force-push 掉对方的 PR

**需要配置**：
- GitHub Secrets → `GH_FORK_SYNC_TOKEN`（有权访问私有 AKEData fork 的 Personal Access Token，过期/无效将硬阻断工作流）
- AKEDatabase 为公开仓库，无须认证
- **注意**：上游仓库必须在工作树外部 clone（CI 中用 `$RUNNER_TEMP`），禁止 clone 到项目目录内，否则会产生 submodule 污染

## 脚本目录结构

```text
scripts/
├── sync-game-data.config.example.json  ← 本地路径配置模板
├── sync-game-data.ts                   ← CLI 入口
├── SYNC_PIPELINE.md                    ← 本文档
└── lib/
    ├── upstream.ts                     ← 路径解析 + sparse clone + 文件读取
    ├── generate-i18n.ts                ← 通用 i18n 生成（stats）
    ├── generate-weapons.ts             ← 武器 i18n（CN title + EN/JP/TC engName）
    ├── generate-equips.ts              ← 装备 i18n（CN name，≥5★）
    ├── generate-dungeons.ts            ← 淤积点 i18n（region 拼接）
    ├── compare-weapons.ts              ← 武器对比（新武器检测 + 专武检测）
    ├── weapon-acquisition.ts              ← 武器来源关系提取 + 冲突/缺失警告
    ├── raw-wiki-data.ts                   ← 生成数据与 i18n 分离的结构化输出
    ├── validate-data.ts                   ← 武器来源关系校验 + 角色头像映射校验
    ├── compare-stats.ts                ← 词条提取
    ├── extract-textid.ts               ← 从原始 JSON 提取 int64 ID
    ├── convert-icons.ts                ← CDN PNG → AVIF（差量）
    ├── download-character-avatars.ts      ← Skland 角色头像/立绘抓取（返回缺失清单）
    ├── skland-character-images.ts         ← Skland 目录/立绘 URL 解析（纯函数）
    └── git-helpers.ts                  ← SHA 分支读写
```
