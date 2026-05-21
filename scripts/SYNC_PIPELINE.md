# Game Data Sync Pipeline

将上游仓库（AKEData、EndFieldTranslationReferrer、AKEDatabase）的游戏数据同步到项目，生成多语言 i18n 文件和图标。

## 上游数据源

| 仓库 | 用途 | 路径示例 |
|------|------|---------|
| AKEData | 武器/装备/角色/副本条目 + 属性数据 | `output/CN/weapon/`, `TableCfg/` |
| EndFieldTranslationReferrer | TextTable 多语言翻译（EN/JP/KR/TC） | `i18n/I18nTextTable_{locale}.json` |
| AKEDatabase | 武器/装备图标 PNG | `public/images/` |

## 环境准备

### 本地配置

在项目根目录创建 `sync-game-data.config.json`（已 gitignore）：

```json
{
  "akedataPath": "D:/GitHub/AKEData",
  "translationPath": "D:/GitHub/EndFieldTranslationReferrer",
  "imagedbPath": "D:/GitHub/AKEDatabase"
}
```

如果上游仓库尚未 clone，脚本会使用默认路径 `upstream/AKEData` 等。可通过 CLI 参数覆盖：

```bash
pnpm sync:check --local \
  --akedata D:/GitHub/AKEData \
  --translation D:/GitHub/EndFieldTranslationReferrer
```

## CLI 命令

```bash
# 检查模式：仅输出差异报告，不修改任何文件
pnpm sync:check [--local]

# 更新模式：生成 i18n 文件 + 转换图标
pnpm sync:update [--local]

# 图标转换（单独运行）
pnpm sync:icons
```

- `--local`：跳过 SHA 分支检查，直接使用本地文件路径
- 不加 `--local`：CI 模式，比较 SHA 后决定是否执行

## 生成文件结构

```
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

### 1. Layout 自动合并

`src/app/[locale]/layout.tsx` 在服务端将游戏 i18n 合并到 `next-intl` 的 messages 中：

```ts
const messages = (await import(`../../messages/${locale}.json`)).default

// 合并游戏内容翻译
for (const category of ['weapons', 'equips', 'dungeons', 'stats', 'regions']) {
  messages[category] = (await import(`../../generated/i18n/${category}/${locale}.json`)).default
}
```

合并后，组件中可以直接使用 `t()` 访问：

```tsx
// 武器名
t('weapons.wpn_funnel_0017')   // → "雾中微光" (zh-CN) / "Flickers in the Mist" (en)

// 地区名
t('regions.fourthValley')      // → "四号谷地" / "Valley IV"

// 淤积点名
t('dungeons.hub')              // → "四号谷地·枢纽区" / "Valley IV·The Hub"
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

## SHA 追踪分支

`auto/upstream-tracking`（orphan 分支，仅存 2 个文件，每次 force push）：

```
.akadata-sha              ← AKEData HEAD commit
.endfieldtranslation-sha  ← EndFieldTranslationReferrer HEAD commit
```

- `pnpm sync:check` 读取此分支的 SHA，与上游当前 HEAD 比较
- 相同 → 跳过；不同 → 执行全量检查
- `pnpm sync:update` 成功后更新 SHA

## CI 工作流

`.github/workflows/sync-game-data.yml`：

- **触发**：每日 06:00 UTC + 手动 dispatch
- **Check 阶段**：shallow sparse clone 上游仓库（仅需的目录），比较 SHA
- **Sync 阶段**：有变更时运行 `sync:update`，自动创建 PR

**需要配置**：
- GitHub Secrets → `AKEDATA_PAT`（有权访问私有上游仓库的 Personal Access Token）
- workflow 中的 `owner/AKEData` 替换为实际仓库路径

## 脚本目录结构

```
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
    ├── convert-icons.ts                ← PNG → AVIF
    └── git-helpers.ts                  ← SHA 分支读写
```
