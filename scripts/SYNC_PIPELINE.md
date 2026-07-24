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

- `pnpm sync:check`：读取此文件记录的 AKEData 与 AKEDatabase SHA，并分别与两个上游当前 HEAD 比较
- 两个 SHA 均相同且图片完整 → 跳过；任一不同或图片缺失 → 执行全量检查
- `pnpm sync:update` 成功后同时更新两个 SHA（通过 PR 提交到主分支）

## CI 工作流

`.github/workflows/sync-game-data.yml`：

- **触发**：每日 06:00 UTC + 手动 dispatch
- **Check 阶段**：shallow sparse clone 上游仓库（仅需的目录），比较 SHA
- **Sync 阶段**：有变更时运行 `sync:update`，自动创建 PR

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
    ├── compare-stats.ts                ← 词条提取
    ├── extract-textid.ts               ← 从原始 JSON 提取 int64 ID
    ├── convert-icons.ts                ← CDN PNG → AVIF（差量）
    └── git-helpers.ts                  ← SHA 分支读写
```
