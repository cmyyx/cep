# Game Data Sync Pipeline

从 `https://data.akedata.wiki` 拉取游戏表数据，同步到项目并生成多语言 i18n 文件和图标。多语言翻译直接取自版本目录下的 `TableCfg/I18nTextTable_*.json`。

## 上游数据源

| 来源 | 用途 | 路径 |
|------|------|------|
| [data.akedata.wiki](https://data.akedata.wiki/manifest.json) | 全部 TableCfg 表 + 14 语言翻译 | `manifest.json` → `public/<游戏版本>/<热更>/TableCfg/` |
| [AKEDatabase](https://github.com/NagiYume/AKEDatabase) | 属性映射 maps.json | `public/{CH,EN,JP,TC}/maps.json`（4 个 13KB 文件，raw 直取，不 clone） |

数据源不再 clone 仓库：每次先读 `manifest.json` 的 `latest`，把需要的表下载到 `scripts/.cache/akedata/<版本 id>/`，同版本重复运行直接命中缓存。版本目录在服务端是不可变的，所以缓存可以一直复用。

## 环境准备

### 子模块（`public/game-i18n`）

`public/game-i18n` 是 [cmyyx/cep-assets](https://github.com/cmyyx/cep-assets) 的**子模块**：
游戏文案导出（15 语言 × 8 MiB 分块）每次同步会全量重写，放在主仓会把历史反复撑大。

- 首次 clone：`git clone --recurse-submodules …`；已有 clone：`pnpm submodules:init`
- 路径与主仓内路径一致（`public/game-i18n`），所以 `next build`、`out/`、`/game-i18n/*` URL、
  构建时的内容指纹清单（`src/generated/game-i18n-hash-manifest.ts`）都不需要改变
- 同步时主仓只记录**子模块指针**；本地跑完 `sync:update` 后要在子仓里自行提交：
  `git -C public/game-i18n add -A && git -C public/game-i18n commit -m "chore: sync game i18n export"`，
  再在主仓提交指针变化。CI 由 `.github/workflows/sync-game-data.yml` 自动完成这两步
  （子仓用 `GH_FORK_SYNC_TOKEN` push）
- 子仓根另有 `README.md` / `.gitattributes`，它们在构建后由 `scripts/prune-export.mjs` 从 `out/` 里剔除，
  不会作为站点资源发布

### 本地配置（可选）

默认走域名，不需要任何本地仓库。只有想用本地 checkout 时才创建 `sync-game-data.config.json`（已 gitignore）：

```json
{
  "akedataPath": "D:/GitHub/AKEData",
  "imagedbPath": "D:/GitHub/AKEDatabase"
}
```

没有配置文件时，`--local` 会回退到默认路径 `../upstream/AKEData` 等（项目目录外）。也可以通过 CLI 参数显式指定（一旦指定 `--akedata` 就按本地模式跑）：

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

- 不加 `--local`：从 data.akedata.wiki 物化数据，比较发布版本 id 决定是否执行（CI 用这个）
- `--local`：使用本地 checkout（`--akedata` / 配置文件），跳过版本闸门
- `AKEDATA_VERSION=1.6.4@11944529-13`：把本次运行钉在某个已发布版本上（可复现构建、排查历史数据）
- `--force`（仅 update 模式）：跳过"已是最新"短路，直接做全量重建。**CI 的 sync job 必须带它** ——
  "是否需要更新"由 check job 判定，update 再自己判一次就会出现"check 说 changed、update 却说
  Up to date、最后没开 PR"（2026-10-06 run #70 就是这个故障）
- `--skland-probe`：check 模式下额外探测 Skland 目录漂移（需要 chromium，见下文第 4 道闸门）

## 生成文件结构

```text
src/generated/i18n/
├── weapons/
│   ├── zh-CN.json     ← CN: WeaponBasicTable + ItemTable title
│   ├── en.json        ← EN: TextTable_EN[engName.id]
│   ├── ja.json        ← JP: TextTable_JP[engName.id]
│   └── zh-TW.json      ← TC: TextTable_TC[engName.id]
├── equips/
│   ├── zh-CN.json      ← CN: EquipTable + ItemTable name（≥5★）
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

## 版本追踪

版本快照记录在主仓库文件 `scripts/.cache/upstream-versions.json` 中（随主分支提交）：

```json
{
  "schemaVersion": 2,
  "akedataVersion": "1.6.4@11944529-13",
  "akedataPublishedAt": "2026-11-21T19:33:07+08:00",
  "imagedbMapsHash": "maps-4c78a3f5e851",
  "lastSync": "2026-11-22T00:00:00.000Z"
}
```

v1（`akedata` / `imagedb` 两个 SHA）仍能读取，但不会匹配任何新快照 —— 升级后第一次同步会做一次全量。

### 更新判定（四道闸门，全过才跳过）

`pnpm sync:check` 只有在**版本 id 与 maps 哈希都相同**时才进入本地一致性校验，任一不同直接判定"有变更"：

1. 选定版本的 id == `akedataVersion`：设置了 `AKEDATA_VERSION` 时为该版本，否则为 manifest 的 `latest`（比 id，不比 `updatedAt`：同版本重发会变时间戳）
2. AKEDatabase 四个 maps.json 的内容哈希 == `imagedbMapsHash`（每次都会重下这 52KB，所以哈希是实时的）
3. 本地一致性：`validateAllData`（武器/装备/淤积点 + 来源关系）、武器 iconId、`validateImages`、
   `validateCharacterAvatarMappings`（banner 引用的角色名是否都能解析出头像）

   `validateAllData` 的条目分两类：`severity: 'warning'` 的是**上游自己缺数据**（如新武器在新客户端
   里还没有任何获取途径），只打印不阻断；其余为 blocking，阻断 `check` 判定与 `update` 退出码。
   两边分开的原因：上游自身缺数据不可能靠重新同步修好，当成不一致会让闸门永远报"有变更"。

**收录规则（`weapons.ts` 与维基一致）**：上游 `WeaponBasicTable` 里**一条获取途径都没有**的武器
（剧情/预留变体，例如 1.6 的 `wpn_sword_0021_ink`）站点不收录 —— `updateWeaponsFile` 不新增条目，
日志打印 `跳过（上游无获取途径, 不收录）`；`generate-wiki-data.ts` 也从维基数据里剔掉它们
（`selectUnlistedWeaponIds` + `excludeWikiWeapons`）。

边界：**已经在 `weapons.ts` 里的条目一律保留**（无论上游有没有途径）—— 不自动移除条目（会丢掉人工
维护的 `chars`），维基也不剔已在列表里的武器，只在校验里报 warning，保证"规划器里有、维基里没有"
不会出现。前瞻武器不在 `WeaponBasicTable` 里，不参与这套规则（收录由前瞻流程负责）。
4. Skland 目录探针（仅 `--check --skland-probe`，CI 的 check job 会带上）：对比线上干员目录与已提交的
   `preview-character-avatars.json` / `sources.json`，命中两类漂移即判定需要更新：
   出现未抓取的前瞻角色、前瞻头像 URL 变了

任一不过 → `exit 2`（`changed=true`）→ 跑 `sync:update`；全过 → `exit 0` → sync job 被跳过。

**为什么需要第 4 道**：Skland 既不在 data.akedata.wiki 里也不在 AKEDatabase 里（其 API 还需要浏览器内签名的
`timestamp`/`sign` 请求），所以第 1-3 道看不见"维基上新出现一个前瞻角色"。没有第 4 道时，只能靠人工
`force_sync` 或等该角色进游戏数据（版本变化）才会刷新头像。第 3 道仍然必要：它负责"本地/分支引用了
没有映射的角色名"（此时 Skland 可能本来就没有这个名字），失败信息是明确的
`[banner] 祀`，而不是 CI 里 4 个测试文件报 `Missing character avatar mapping`。

**第 4 道失败即忽略**：浏览器缺失、网络错误、Skland 改版都返回 `probeError` 并按"无变化"处理，只打
warning —— 不让维基挂掉把数据同步整条卡死。

- `pnpm sync:update` 成功后写入版本 id / 发布时间 / maps 哈希（通过 PR 提交到目标分支）
- 头像抓取新增硬校验：抓取后 `downloadCharacterAvatars` 返回的 `missing` 非空（对比本次生成的
  Wiki 资源清单）→ 直接 `exit 1`，不开注定过不了 CI 的 PR。抓取失败被跳过时，`missing` 按
  已有目录计算，因此"保留旧头像"不会掩盖新角色缺图

## CI 工作流

`.github/workflows/sync-game-data.yml`：

- **触发**：每周四、周五 00:00 UTC（cron `0 0 * * 4,5`）+ 手动 dispatch
- **Check 阶段**：读 manifest 比较版本 id + maps 哈希，再跑本地一致性（含角色头像映射）+ Skland 目录探针（需要 chromium）
- **Sync 阶段**：有变更时运行 `sync:update --force`（update 不再自己判一次闸门），物化新版本的 TableCfg 后自动创建 PR 到**触发它的那个分支**
- **手动强制**：dispatch 时勾选 `force_sync` → **整个 check job 被跳过**（不装 chromium、不比对版本），
  直接运行 `sync:update --force`（版本没动但头像/映射过期时的入口）
- **不缓存表**：`actions/cache` 主键命中后不会覆盖，check 存的半套缓存会让 sync 反复补下 locale 文件，所以每次重下（check 几 MB，sync 约 100MB）
- **PR 分支命名**：`base = 触发分支`，head 分支 `auto/sync-game-data-<触发分支>`，
  因此不同分支的 sync 不会互相 force-push 掉对方的 PR

**需要配置**：
- GitHub Secrets → `GH_FORK_SYNC_TOKEN`：只用于 clone/push `cmyyx/cep-assets` 子模块；数据读取不再需要它
- data.akedata.wiki 与 AKEDatabase 都是公开的，无须认证
- 物化目录固定在 `scripts/.cache/`（已 gitignore），不会产生 submodule 污染

## 脚本目录结构

```text
scripts/
├── sync-game-data.config.example.json  ← 本地路径配置模板
├── sync-game-data.ts                   ← CLI 入口
├── SYNC_PIPELINE.md                    ← 本文档
└── lib/
    ├── upstream.ts                     ← 数据源解析（域名物化 / 本地 checkout）
    ├── akedata-remote.ts               ← manifest 解析 + TableCfg 下载 + maps.json 哈希
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
    └── git-helpers.ts                  ← 版本快照读写（v2，兼容 v1 SHA）
```
