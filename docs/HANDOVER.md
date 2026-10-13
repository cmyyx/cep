# 交接文档：面板计算机制修复 + 卡池 / 前瞻数据自动同步

> 分支工作树状态：第一批（23 修改 + 12 新增 + 本文档）已提交为 `b51dd4b1be`；之后又跑了一次**本地全量同步**，
> 落地 39 个真实内容改动（含 4 个新图标），另 396 个文件只是换行符噪音（`git add` 后自动消失）。
> `tsc` / `eslint` / `vitest`（210 文件 / 1429 测试）/ `check-i18n`（0 P0）全绿。
> 本文记录**做了什么、为什么这么做、还差什么、怎么上线**。

---

## 1. 目标

起因：面板预览的**生命值**与游戏内偏差 33%（余烬 + 大雷斑 + 生物辅助四件：面板 19068 / 游戏 25330）。
顺着这个 bug 把面板计算机制按**游戏客户端数据**（AKEData）逐条对齐，并把"卡池 UP / 前瞻武器"这类目前人工维护的数据改成自动同步。

证据优先级：**AKEData（表 / Lua / IL2CPP 签名）> 社区文章 > 游戏内实测**。
文章只作线索：每一条都落到表或实测才动手（两篇文章：`藕粉选修三 新乘区导论`、`终末地数据机制导论`）。

---

## 2. 已完成

### 2.0 数据落地（本地同步已完成）

本地 `D:/GitHub/AKEData` 已更新到 **`fd324e7506`（2026-10-08）= 云端 main HEAD**，比 CEP 记录的上次同步 `e796ccc3`（10-06）新 2 天。

```bash
npx tsx scripts/sync-game-data.ts --update --local --force \
  --akedata D:/GitHub/AKEData --imagedb D:/GitHub/AKEDatabase
```

结果：`All data consistent with upstream`；`modifierType` 983/983 条装备词条齐、`attributeLimits` 28 条属性、
图标只新转 4 个（前瞻武器）、`I18nTextTable` 导出 149,414 条/语言 × 14 语言。

**上游翻译已到齐**：`TableCfg/I18nTextTable_*.json`（扁平键 `"-1414695695683300716": "玉中身"`）4 把前瞻武器 4/4 全语言可解析：

| 正式 ID | zh-CN | en | ja | zh-TW |
|---|---|---|---|---|
| `wpn_claym_0018` | 玉中身 | Jade Vessel | 玉芯 | 玉中身 |
| `wpn_claym_0019` | 悠久传承 | Long Heritage | 悠久の継承 | 悠久傳承 |
| `wpn_sword_0024` | 聚合工业 | Complexed Industry | 複合工業 | 聚合工業 |
| `wpn_sword_0025` | 唤月 | Lunar Calling | 喚月 | 喚月 |

匹配策略因此升级为**名字优先、标签兑底**：客户端 CN 名与 `preview:` 条目同名即同一把，
两把完全同标签的双手剑（玉中身 / 悠久传承）靠名字就能分开 → **4/4 唯一匹配、0 警告**，全部显示真图标。

### 2.1 面板计算机制（`src/lib/planner/progression.ts`）

| # | 结论 | 依据 | 状态 |
|---|---|---|---|
| 1 | **力量→生命的换算属于基值加成池**：`(raw + 力量×5 + 固定生命) × (1 + 生命%)`，原实现加在百分比之后 | `Attributes.GetHpBaseAddFromStrAttribute()` 命名 + `ModifierType.BaseAddition=5 / BaseMultiplier=6` + `AttributesCalculator._CalculateBaseAttribute` 参数顺序 + 游戏内实测 | ✅ 已改 + 测试 |
| 2 | **四维取整数部分**再参与派生公式（力量→生命/攻击、敏捷/智识→抗性、意志→受治疗） | 游戏内实测两例：力量显示 695 → 「力量提供的生命」3475（=5×695，真值 695.41174 会给 3477）；属性详情「来自力量的攻击加成 +171.0%」= 0.005×342（真值会给 171.2%） | ✅ 已改 + 测试 |
| 3 | **敏捷/智识→抗性是反比例**：`1 − 1/(1 + 0.001×属性)`，原为线性 `属性×0.001` | `AttributeShowConfigTable` 里 attrType 80–84 的显示格式 `{100-100*value:0}`；`BattleConst` 的 0.001 / `charResistanceMaxValue=90` / `charDmgResistMinValue=0.1` | ✅ 已改 + 测试 |
| 4 | **显示层按游戏口径**：先 `round(v,1e-5)` 再 `floor`（非百分比） | `AKEData/LuaScripts/Common/Utils/AttributeUtils.lua:282-355` + `lume.round`（`floor(x+0.5)`） | ✅ `src/lib/game-display-value.ts` + 面板卡片（游戏值为主 + 精确值小字 + 说明行，i18n 四语言） |
| 5 | **装备词条乘区**：`modifierType=7`（BaseFinalAddition）要在基值乘算**之后**相加 | `ModifierType` 枚举 + `_CalculateBaseAttribute` + Lua `getAtkTotalBaseDetailList` 的"百分比加成/固定数值加成"拆分 | ✅ 代码 + 数据均已落地（mod7 实测样例：`tundra01_body_01` MaxHp = 46.3273721859878） |
| 6 | **套组效果白名单**：删掉 `hp_add` 死分支（原表里它是"击败敌人后回复 100 点生命值"的回复量）；生成器白名单补 `def_up: 防御力` | `scripts/lib/generate-planner-data.ts` 的 `STATIC_SET_VALUE_LABELS` + 258 份装备 wiki JSON 全量核对 | ✅ |
| 7 | **属性钳制（Clamp）**：每个乘区结算后按 `AttributeMetaTable` 的 min/max 钳制，乘算池取下限 0 | `AttributeMetaTable` + `_CalculateBaseAttribute(..., min, max)` 签名；池下限来自文章 | ✅ 代码 + 数据均已落地（28 条属性限值） |

### 2.2 卡池日历自动同步

| 文件 | 作用 |
|---|---|
| `scripts/lib/generate-gacha-pools.ts`（+ 测试 7 条） | 读 `GachaCharPoolTable.upCharIds` / `TimeRangeTable.time_<poolId>` / `GachaCharPoolContentTable`(交叉校验) → `src/generated/data/gacha-pools.ts` |
| `src/lib/banner-schedule.ts`（+ 测试 8 条） | 排期**上游优先、手写兜底**；差异记为 `repairs`；`resolveEntryWindow()` 供卡面显示 |
| `src/data/banner.ts` | `bannerSchedule` 改为上游驱动，新增 `bannerScheduleRepairs` / `entryWindow()` |
| `src/components/banner-calendar/pool-info-strip.tsx` | 卡面/详情时间改用 `entryWindow()`（与时间轴一致） |
| `scripts/sync-game-data.ts` | 新增 `-- Gacha pools --` 步骤，打印"日历自动修正 N 处手写档期" |

**当前结果**：12 个卡池带 UP + 时间；`joint_1_2_2 = [雷万汀, 安洁莉娜]`（多 UP 正确）；`rerun_1_5_2`（9/24–10/15）有档期无名单 → 进 `scheduledWithoutPool`，不猜；`rerun_chr_yvonne` 有名单无档期 → issue；17 处手写档期被自动修正。

**时间口径**：`TimeRangeTable` 每个池 3 条候选（取 entry[0]）= **实际开池时间**（维护提前结束即可抽，比公告早 5~6 小时）；公告的 12:00/11:59 属展示口径。因此**校验只看日期是否同日 + 小时差 ≤ 8h**，差异本身是预期差。

### 2.3 前瞻武器接入

| 文件 | 作用 |
|---|---|
| `scripts/lib/generate-foresight.ts`（+ 测试 9 条） | 判定 `isForesight = !WeaponBasicTable[id]` 并用 `ForesightWeaponGemwishlistTable` 交叉验证；产出可得字段 + `previewCandidates`/`previewMatch` |
| `src/types/foresight.ts`、`src/generated/data/foresight-weapons.ts` | 类型 + 已生成数据（4 把） |
| `scripts/lib/wiki-assets.ts` + `generate-wiki-data.ts` | `extraWeaponIconIds`：把前瞻武器图标送进 convert-icons（CDN `sprites/itemiconbig`，实测 4 个都 200） |
| `src/lib/foresight-weapons.ts` + `src/components/essence/weapon-card.tsx` | 唯一匹配的前瞻条目**显示真图标**（不再是首字占位） |

**与 CEP 现有前台条目的匹配**（`src/data/weapons.ts` 里的 `preview:` 条目，按 类型+稀有度+gemTagIds）：

| 前瞻正式 ID | 匹配到 | 结果 |
|---|---|---|
| `wpn_sword_0025` | `preview:唤月` | ✅ unique（真图标） |
| `wpn_sword_0024` | `preview:聚合工业` | ✅ unique（真图标） |
| `wpn_claym_0018` | `preview:玉中身` | ✅ unique（名字消歧） |
| `wpn_claym_0019` | `preview:悠久传承` | ✅ unique（名字消歧） |

**名字来源**：前瞻武器没有 `ItemTable` 条目（未上线），名字取自前瞻表 `name.id` → `I18nTextTable_*`（上游权威翻译）。
生成器只在文本真的存在时取值，取不到就记 `names: null` 并写进 `issues`，不猜。

---

## 3. 待办

只列真正还开着的事（前面的数据落地 / 翻译 / 歧义均已关闭）：

| # | 事项 | 依赖 | 备注 |
|---|---|---|---|
| 1 | **P1-4 装备词条显示文本按游戏格式说明符**：上游 `AttributeShowConfigTable.valueFormat` 是 `{value:0.0%}`（1 位小数）/ `{value}`（非百分比取整），当前 `formatEquipStat` 只做了 ×100+`%`，**没处理小数位** | 无（不需要截图，规则齐全：表里的 `valueFormat` + `Lua/Common/Utils/AttributeUtils.lua` 的取整） | 纯显示问题，不影响面板数值。实例：attr29 `mod5={value:0.0%}` 的 0.1035 现在输出 `10.35%`（游戏 10.4%）；tundra 的 MaxHp 46.3273721859878 现在输出 `生命值+46.32737219`（游戏 `生命值+46`） |
| 2 | `rerun_1_5_2` / `rerun_chr_yvonne` 的上游数据缺口 | 上游 | 见 §3.1（这两条其实是同一个复刻池被拆到两张表里） |

**已明确不做**（用户决定）：
- 前瞻角色（明河 / 祀）的 wiki / 面板条目 —— 上游没有角色表（`ForesightChar*` 只有成长/推荐武器/养成配置，无 name/属性/技能），同步变不出来；卡池日历已有的预览头像已足够。
- `time_gift_*`（流行品排期）—— 与卡池/前瞻/面板无关，不列入范围。

### 3.1 两个复刻池数据缺口

| 上游 id | 有 UP 名单 | 有档期 | 情况 |
|---|---|---|---|
| `rerun_1_5_2` | 无（`GachaCharPoolTable` 无此行） | 有（`time_rerun_1_5_2` = 2026-09-24 ~ 10-15） | 记录在 `scheduledWithoutPool` |
| `rerun_chr_yvonne` | 有（伊冯） | 无（`time_rerun_chr_yvonne` 不存在） | 记录在 `issues` |

两边时间/内容一致 + CEP 手写卡面 `1.5-yifeng`（伊冯重构寻访，2026-09-24 ~ 10-15）→ 可断定是**同一个复刻池**，只是上游把名单和档期拆在两张不交叉的表里。
当前处理：只记录不显示（卡面由手写 entry 覆盖，功能不缺）；若要让日历完全上游驱动，再加一条"档期唯一命中时合并名单/档期"的规则（需你确认）。

---

## 4. 上线流程

```bash
# A. 本地同步（现在可行：本地 AKEData 已 = 云端 main HEAD）
#    提交工作树后跑，同步产生的差异会以干净 diff 呈现
git add -A && git commit -m "..."
npx tsx scripts/sync-game-data.ts --update --local --force \
  --akedata D:/GitHub/AKEData --imagedb D:/GitHub/AKEDatabase
git add -A && git commit -m "chore(data): 同步上游数据"

# B. 也可走 CI（上游有更新但本地仓库旧时）
#    GitHub Actions → Sync Game Data → Run workflow
#    - Branch: <你的分支>；force_sync: true（不勾会因 SHA 未变而跳过）
#    它会开一个 PR: auto/sync-game-data-<分支> → <你的分支>

# 无论哪条路，合并前重点看这些文件
#    - src/generated/data/planner.ts            是否出现 modifierType / attributeLimits
#    - src/generated/data/wiki/assets.json      前瞻武器图标是否入列（+4）
#    - src/generated/data/foresight-weapons.ts  names 是否 4/4、previewMatch 是否 unique
#    - public/game-i18n/manifest.json           entryCount 是否更新
#    - 其余 i18n / weapons.ts / 图标 属上游漂移，按目录分组审阅

# C. 分支 → main 的 PR 才会跑 Quality Gate（ci.yml 只监听 main）
```

**换行符噪音**：同步写出的生成文件带 LF，仓库里剩的是 CRLF，所以 `git status` 会多出 ~400 个 `M`；
它们 `git add` 后会因 `.gitattributes` 归一化而消失——不用手动清理，也不要把它当成真实改动。

**本地同步的前置条件**：本地 AKEData 必须 ≥ 仓库记录的 `scripts/.cache/upstream-versions.json` 版本。
以前本地是 2026-09-08 的旧快照（落后于记录的 10-06 `e796ccc3`），全量重生成会**删掉** `chr_0038_purrche`、`wpn_sword_0023`，
所以当时只能走 CI；现在已是 10-08 的 `fd324e7506`，本地同步安全。
（需要单文件核对时：`gh api repos/cmyyx/AKEData/contents/<path>` / `git/blobs/<sha>`；>1MB 的文件 contents API 不返回内容，必须用 blob API。）

---

## 5. 验证

```bash
npx tsc --noEmit        # 0 错误
npx eslint              # 0 错误 0 警告
npx vitest run          # 210 文件 / 1429 测试全过
node scripts/check-i18n.mjs   # 0 P0（28 个警告均为既有的 P2 死键 / 动态 key，与本次无关）
```

关键数值（余烬 L90 + 大雷斑 L9 + 生物辅助四件，全满）：

| 项目 | 修复前 | 现在（精确值 / 面板显示） |
|---|---|---|
| 力量提供生命 | +3372.06 | **+3370**（=5×674）/ 3,370 |
| 力量提供攻击 | +337.21% | **+337%**（=674×0.005） |
| 敏捷物理减免 | 9.6959% | **8.7591%** |
| 智识法术减免 | 8.6753% | **7.9190%** |
| 生命值 | 19067.98 | **25321.986 / 25,321** |
| 攻击力 | 4110.11 | **4107.996 / 4,107** |

---

## 6. 文件清单

**新增**
- `src/lib/game-display-value.ts`（+ test）：游戏显示口径取整
- `src/lib/banner-schedule.ts`（+ test）：卡池排期组装与手写差异修正
- `src/lib/foresight-weapons.ts`：前瞻条目 → 正式 ID / 图标
- `src/types/foresight.ts`
- `scripts/lib/generate-gacha-pools.ts`（+ test）
- `scripts/lib/generate-foresight.ts`（+ test）
- `src/generated/data/gacha-pools.ts`、`src/generated/data/foresight-weapons.ts`（生成产物，CI 会覆盖）

**修改**
- `src/lib/planner/progression.ts`（+ test）：基值池次序、四维取整、抗性公式、Clamp
- `src/components/panel-preview/panel-stats-summary.tsx`（+ test）：显示游戏值 + 精确值小字
- `src/data/banner.ts`、`src/types/banner.ts`、`src/components/banner-calendar/pool-info-strip.tsx`（+ test）
- `src/components/essence/weapon-card.tsx`：前瞻真图标
- `src/types/planner.ts`、`src/types/wiki/index.ts`：`modifierType` / `attributeLimits`
- `scripts/lib/build-item-wiki.ts`（+ test）、`scripts/lib/generate-planner-data.ts`（+ test）、`scripts/lib/wiki-assets.ts`（+ test）、`scripts/lib/generate-wiki-data.ts`、`scripts/sync-game-data.ts`
- `src/messages/{zh-CN,en,ja,zh-TW}.json`：面板显示口径说明行
- `src/lib/planner/progression.test.ts`：mod-7 / Clamp 兼容分支改为自建桩数据（真数据现在总带这两个字段）

**本地同步产生的内容改动（39 个）**
- `src/generated/data/planner.ts`：设备词条 `modifierType`（983 条）+ `attributeLimits`（28 条）
- `src/generated/data/foresight-weapons.ts`：4/4 多语言名 + `previewMatch: unique`
- `src/generated/data/wiki/assets.json`：+4 前瞻武器图标
- `public/images/weapon/wpn_{claym_0018,claym_0019,sword_0024,sword_0025}.avif`：新图标（生成产物）
- `public/game-i18n/**`、`src/generated/i18n/**`：上游翻译/清单漂移
- `src/generated/data/wiki/**`：wiki 实体重建（weapons 80 / equipment 258 / characters 32）
