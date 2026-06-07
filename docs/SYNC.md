# 同步上游游戏数据

CEP 的武器、装备、淤积点数据来自上游游戏数据仓库，数据文件（`src/data/weapons.ts`、`src/data/equips.ts`、`src/data/dungeons.ts`）及多语言翻译（`src/generated/i18n/`）由同步脚本自动生成或更新。

## 上游数据源

三个 Git 仓库，路径通过 `sync-game-data.config.json` 配置：

| 仓库 | 配置键 | 内容 |
|------|--------|------|
| AKEData | `akedataPath` | 游戏原始表结构（TableCfg）、输出数据（output/CN/） |
| AKEDatabase | `imagedbPath` | 装备图标、武器/装备 JSON、v2_equip 数据 |
| EndFieldTranslationReferrer | `translationPath` | 多语言文本表（I18nTextTable_CN/EN/JP/TC.json） |

### 配置

项目根目录 `sync-game-data.config.json`：

```json
{
  "akedataPath": "D:/GitHub/AKEData",
  "translationPath": "D:/GitHub/EndFieldTranslationReferrer",
  "imagedbPath": "D:/GitHub/AKEDatabase"
}
```

> CLI 参数优先级高于配置文件：`--akedata <path>`、`--translation <path>`、`--imagedb <path>`。

### 首次克隆上游仓库

将三个仓库克隆到 `upstream/` 目录（或你指定的任意路径），然后在 `sync-game-data.config.json` 中填写对应路径。

## 命令

```bash
# 检查模式：对比差异，只输出不修改（CI 用）
pnpm sync:check

# 更新模式：同步武器/装备/地牢数据 + 生成 i18n + 转换图标
pnpm sync:update

# 仅转换图标（不更新数据）
pnpm sync:icons

# 本地模式：跳过 SHA 检查和 git fetch
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
1. 路径校验
   └─ validatePaths() — 检查 AKEData/Translation 目录及必要子目录

2. SHA 检查（非 --local 模式）
   └─ 对比 scripts/.cache/upstream-versions.json 中的 SHA 与上游当前 HEAD
   └─ 无变动则跳过，有变动 exit code 2（CI 触发 sync job）

3. 武器数据（Weapons）
   ├─ compareWeapons()       — 对比项目数据与上游，列出新增武器
   ├─ updateWeaponsFile()    — 新武器写入 src/data/weapons.ts
   ├─ generateWeaponI18n()   — 生成 src/generated/i18n/weapons/*.json
   ├─ generateWeaponStatsI18n() — 生成 src/generated/i18n/weaponStats/*.json
   └─ generateWeaponStatMapping() — 生成 src/generated/weapon-stat-mapping.ts

4. 装备数据（Equips）
   ├─ compareEquips()        — 对比项目数据与上游
   ├─ updateEquipsFile()     — 新装备写入 src/data/equips.ts
   ├─ generateEquipI18n()    — 生成 src/generated/i18n/equips/*.json
   └─ generateEquipStatMapping() — 生成 src/generated/equip-stat-mapping.ts

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

9. 图标转换（Image conversion）
   └─ convertIcons()         — 上游 PNG → public/images/ 的 AVIF（weapon + equip）

10. SHA 更新（非 --local 模式）
    └─ writeUpstreamVersions() — 写入 scripts/.cache/upstream-versions.json（随 PR 提交）
```

## 单脚本调用

同步管线中的每个生成步骤也可单独执行：

```bash
# 仅武器 i18n
npx tsx scripts/lib/generate-weapons.ts

# 仅装备 stat mapping
npx tsx scripts/lib/generate-equip-stat-mapping.ts
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
| `src/generated/weapon-stat-mapping.ts` | 武器技能名 → gemTermId 映射 |
| `src/generated/equip-stat-mapping.ts` | 装备属性名 → canonical key 映射 |
| `public/images/weapon/*.avif` | 武器图标 |
| `public/images/equip/*.avif` | 装备图标 |

## 注意事项

- 地牢名中的区域部分（`<待填写>·xxx`）需手动填写，同步脚本只填子区域名
- 新武器的 `chars` 字段为空数组，需手动补充适配角色
- 装备 `type` 字段由上游 `partType`（0=护甲, 1=护手, 2=配件）自动推断
- `--local` 模式跳过 `git fetch` 和 SHA 检查，适合本地开发使用
