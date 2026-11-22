# 同步上游游戏数据

CEP 的武器、装备、淤积点数据来自上游游戏数据源，数据文件（`src/data/weapons.ts`、`src/data/equips.ts`、`src/data/dungeons.ts`）及多语言翻译（`src/generated/i18n/`）由同步脚本自动生成或更新。

## 上游数据源

默认直接从 `https://data.akedata.wiki` 取数：先读 `manifest.json` 的 `latest`，再把本版本目录下的 TableCfg 表下载到 `scripts/.cache/akedata/<版本 id>/`。属性映射拉 AKEDatabase 的四个 `maps.json`（raw 直取，不 clone）。

| 来源 | 内容 |
|------|------|
| data.akedata.wiki | 全部 TableCfg 表 + 14 语言 `I18nTextTable_*.json` |
| AKEDatabase | 属性映射 maps.json（CH/EN/JP/TC） |

> 多语言翻译直接取自版本目录下的 `TableCfg/I18nTextTable_{CN,EN,JP,TC,...}.json`
> 版本可用 `AKEDATA_VERSION=1.6.4@11944529-13` 固定；不设置时跟 `latest`。

### 配置（可选）

默认不需要配置文件。想用本地 checkout 时才创建项目根目录 `sync-game-data.config.json`：

```json
{
  "akedataPath": "D:/GitHub/AKEData",
  "imagedbPath": "D:/GitHub/AKEDatabase"
}
```

> CLI 参数优先级高于配置文件：`--akedata <path>`、`--imagedb <path>`。

### 本地 checkout（可选）

把 AKEData / AKEDatabase clone 到任意目录，在 `sync-game-data.config.json` 中填写路径，运行时加 `--local`。不配置就走域名。

## 命令

```bash
# 检查模式：对比差异，只输出不修改（CI 用）
pnpm sync:check

# 更新模式：同步武器/装备/地牢数据 + 生成 i18n + 转换图标
pnpm sync:update

# 本地模式：使用本地 checkout，跳过版本闸门
pnpm sync:update --local
```

### 常用场景

```bash
# 日常：上游有新数据，全量同步
pnpm sync:update --local

# CI：仅检查是否有新数据，返回 exit code 2 表示需更新
pnpm sync:check
```

## 同步流程

`pnpm sync:update` 依次执行：

```
1. 数据源解析
   ├─ 默认：读 data.akedata.wiki/manifest.json，把本版本的 TableCfg 物化到 scripts/.cache/
   └─ validatePaths() — 校验 TableCfg 目录与 AKEDatabase maps.json 目录

2. 版本检查（非 --local 模式）
   ├─ 对比 scripts/.cache/upstream-versions.json 中的版本 id 与 manifest.latest
   ├─ 一致 → 校验 maps 哈希、项目数据、武器 iconId 与生成图片；全部一致才跳过
   ├─ 存在差异 + --check 模式 → exit code 2（CI 触发 sync job）
   └─ 存在差异 + --update 模式 → 继续执行后续同步步骤

3. 武器数据（Weapons）
   ├─ compareWeapons()       — 对比项目数据与上游，报告新增武器
   ├─ updateWeaponsFile()    — 全量对账三星及以上武器的上游字段并补齐缺失记录
   ├─ reconcileWeaponsIconIds() — 对账 ItemTable.iconId
   ├─ generateWeaponI18n()   — 生成 src/generated/i18n/weapons/*.json
   └─ generateWeaponStatsI18n() — 生成 src/generated/i18n/weaponStats/*.json

4. 装备数据（Equips）
   ├─ compareEquips()        — 对比项目数据与上游
   ├─ updateEquipsFile()     — 新装备写入 src/data/equips.ts
   └─ generateEquipI18n()    — 生成 src/generated/i18n/equips/*.json

5. 地牢数据（Dungeons）
   ├─ compareDungeons()      — 对比项目数据与上游
   ├─ updateDungeonsFile()   — 新地牢写入 src/data/dungeons.ts
   └─ generateDungeonI18n()  — 生成 src/generated/i18n/dungeons/*.json + regions/*.json

6. 元数据（Metadata）
   └─ generateMetadataI18n() — 生成 src/generated/i18n/equipTypes/*.json + materials/*.json

7. 属性 i18n（Stat i18n）
   └─ generateStatI18n()     — 生成 src/generated/i18n/gemStats/*.json + equipStats/*.json

8. 数据校验（Validation）
   └─ validateAllData()      — 校验 weapons/dungeons 与上游一致性

9. 图标转换（Image conversion，仅 update 模式）
   └─ convertIcons()         — 上游 PNG → public/images/ 的 AVIF（weapon + equip）

10. 图片验证（Image validation）
    └─ validateImages()      — 校验所有 weapon/equip AVIF 存在，缺失则 exit(1) 阻断同步

11. 版本快照（非 --local 模式）
    └─ writeUpstreamVersions() — 写入版本 id / 发布时间 / maps 哈希到 scripts/.cache/upstream-versions.json（随 PR 提交）
```
## 单脚本调用

同步管线中的每个生成步骤也可单独执行：

```bash
# 仅武器 i18n
npx tsx scripts/lib/generate-weapons.ts

# 仅装备 i18n
npx tsx scripts/lib/generate-equips.ts
```

> 单脚本调用需要手动解析路径，一般通过 `sync-game-data.ts` 入口统一管理。

## 生成文件

同步脚本写入以下文件（均被 `.gitignore` 排除或通过 git 追踪）：

| 文件 | 说明 |
|------|------|
| `src/data/weapons.ts` | 武器条目（新武器自动追加） |
| `src/data/equips.ts` | 装备条目 + EQUIP_ID_MAP（新装备按套装分组插入） |
| `src/data/dungeons.ts` | 淤积点条目（新淤积点自动追加） |
| `src/generated/i18n/weapons/*.json` | 武器名多语言 |
| `src/generated/i18n/weaponStats/*.json` | 武器属性名多语言 |
| `src/generated/i18n/equips/*.json` | 装备名多语言 |
| `src/generated/i18n/dungeons/*.json` | 淤积点名多语言 |
| `src/generated/i18n/regions/*.json` | 区域/子区域名多语言 |
| `src/generated/i18n/gemStats/*.json` | 宝石属性多语言 |
| `src/generated/i18n/equipStats/*.json` | 装备属性多语言 |
| `src/generated/i18n/equipTypes/*.json` | 装备类型多语言 |
| `src/generated/i18n/materials/*.json` | 材料名多语言 |
| `public/images/weapon/*.avif` | 武器图标 |
| `public/images/equip/*.avif` | 装备图标 |

## 注意事项

- 地牢名中的区域部分（`<待填写>·xxx`）需手动填写，同步脚本只填子区域名
- 新武器的 `chars` 字段为空数组，需手动补充适配角色
- 装备 `type` 字段由上游 `partType`（0=护甲, 1=护手, 2=配件）自动推断
- `--local` 模式跳过 `git fetch` 和 SHA 检查，适合本地开发使用
