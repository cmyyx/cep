# 交接文档：面板计算机制修复 + 卡池 / 前瞻数据自动同步

> 分支工作树状态：23 个文件修改 + 12 个新增 + 本文档；`tsc` / `eslint` / `vitest` 全绿（详见 §5）。
> 本文记录**做了什么、为什么这么做、还差什么、怎么上线**。

---

## 1. 目标

起因：面板预览的**生命值**与游戏内偏差 33%（余烬 + 大雷斑 + 生物辅助四件：面板 19068 / 游戏 25330）。
顺着这个 bug 把面板计算机制按**游戏客户端数据**（AKEData）逐条对齐，并把"卡池 UP / 前瞻武器"这类目前人工维护的数据改成自动同步。

证据优先级：**AKEData（表 / Lua / IL2CPP 签名）> 社区文章 > 游戏内实测**。
文章只作线索：每一条都落到表或实测才动手（两篇文章：`藕粉选修三 新乘区导论`、`终末地数据机制导论`）。

---

## 2. 已完成

### 2.1 面板计算机制（`src/lib/planner/progression.ts`）

| # | 结论 | 依据 | 状态 |
|---|---|---|---|
| 1 | **力量→生命的换算属于基值加成池**：`(raw + 力量×5 + 固定生命) × (1 + 生命%)`，原实现加在百分比之后 | `Attributes.GetHpBaseAddFromStrAttribute()` 命名 + `ModifierType.BaseAddition=5 / BaseMultiplier=6` + `AttributesCalculator._CalculateBaseAttribute` 参数顺序 + 游戏内实测 | ✅ 已改 + 测试 |
| 2 | **四维取整数部分**再参与派生公式（力量→生命/攻击、敏捷/智识→抗性、意志→受治疗） | 游戏内实测两例：力量显示 695 → 「力量提供的生命」3475（=5×695，真值 695.41174 会给 3477）；属性详情「来自力量的攻击加成 +171.0%」= 0.005×342（真值会给 171.2%） | ✅ 已改 + 测试 |
| 3 | **敏捷/智识→抗性是反比例**：`1 − 1/(1 + 0.001×属性)`，原为线性 `属性×0.001` | `AttributeShowConfigTable` 里 attrType 80–84 的显示格式 `{100-100*value:0}`；`BattleConst` 的 0.001 / `charResistanceMaxValue=90` / `charDmgResistMinValue=0.1` | ✅ 已改 + 测试 |
| 4 | **显示层按游戏口径**：先 `round(v,1e-5)` 再 `floor`（非百分比） | `AKEData/LuaScripts/Common/Utils/AttributeUtils.lua:282-355` + `lume.round`（`floor(x+0.5)`） | ✅ `src/lib/game-display-value.ts` + 面板卡片（游戏值为主 + 精确值小字 + 说明行，i18n 四语言） |
| 5 | **装备词条乘区**：`modifierType=7`（BaseFinalAddition）要在基值乘算**之后**相加 | `ModifierType` 枚举 + `_CalculateBaseAttribute` + Lua `getAtkTotalBaseDetailList` 的"百分比加成/固定数值加成"拆分 | ⚠️ 代码已就绪（`baseFinalAdditions` 池 + 兼容回退），**数据待同步** |
| 6 | **套组效果白名单**：删掉 `hp_add` 死分支（原表里它是"击败敌人后回复 100 点生命值"的回复量）；生成器白名单补 `def_up: 防御力` | `scripts/lib/generate-planner-data.ts` 的 `STATIC_SET_VALUE_LABELS` + 258 份装备 wiki JSON 全量核对 | ✅ |
| 7 | **属性钳制（Clamp）**：每个乘区结算后按 `AttributeMetaTable` 的 min/max 钳制，乘算池取下限 0 | `AttributeMetaTable` + `_CalculateBaseAttribute(..., min, max)` 签名；池下限来自文章 | ⚠️ 生成器 + 运行时已就绪，**数据待同步**（缺字段时自动跳过） |

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
| `wpn_sword_0025` | `preview:唤月` | ✅ unique（已显示真图标） |
| `wpn_sword_0024` | `preview:聚合工业` | ✅ unique（已显示真图标） |
| `wpn_claym_0018` / `wpn_claym_0019` | `preview:玉中身` / `preview:悠久传承` | ⚠️ **ambiguous**（两把标签完全相同，待人工确认） |

**名字来源**：前瞻武器在客户端里没有文本（云端 `ItemTable`/`I18nTextTable_CN` 11.9MB 都已核对，4 把既无 ItemTable 条目，前瞻表的 `name.id` 也不属于游戏文本 id 口径）→ 名字用 CEP 自己 `preview:` 条目里人工核对过的名称，生成器如实把 `names` 记为 `null`，上游补文本后自动填。

---

## 3. 待办

| # | 事项 | 依赖 | 备注 |
|---|---|---|---|
| 1 | **数据落地**：装备 `modifierType`、`attributeLimits` 写进 `planner.ts`；`equipment/*.json` 带 `modifierType`；重建 `gacha-pools.ts` / `foresight-weapons.ts` | 云端 sync | 代码已就绪且向后兼容，缺字段自动按旧行为 |
| 2 | **P1-4 装备 `displayValues` 按 .NET 说明符**（非百分比 floor；百分比按 `0.0%` / `2` 位小数；现为 8 位小数清理） | 需要游戏内装备浮窗截图核对小数位/进位 | 会改约 1000 条显示串 |
| 3 | `玉中身` / `悠久传承` ↔ `claym_0018` / `claym_0019` 人工确认 | 你 | 确认后写成显式映射，生成器继续校验 |
| 4 | 前瞻角色（明河 / 祀）尚无 wiki / 面板条目（只有 banner 头像 + 前瞻表数据） | 产品决定 | `ForesightCharGrowthTable` 当前只用于 gift/复刻判定，未接入 |
| 5 | `time_gift_*`（流行品排期，11 条） | 未列入范围 | 与卡池无关，将来可做"本周流行品" |

---

## 4. 上线流程

```bash
# 1. 提交并推送分支
git add -A && git commit -m "..." && git push -u origin <branch>

# 2. GitHub Actions → Sync Game Data → Run workflow
#    - Branch: <你的分支>
#    - force_sync: true   （必须勾：默认会因上游 SHA 未变而跳过，导致新字段不进数据）
#    它会开一个 PR: auto/sync-game-data-<分支> → <你的分支>

# 3. 合并该 PR（重点看这些文件）
#    - src/generated/data/planner.ts           是否出现 modifierType / attributeLimits
#    - src/generated/data/wiki/equipment/*.json 是否带 modifierType
#    - src/generated/data/gacha-pools.ts / foresight-weapons.ts 是否重建
#    - 其余 i18n / weapons.ts / 图标 属上游漂移，按目录分组审阅

# 4. 分支 → main 的 PR 才会跑 Quality Gate（ci.yml 只监听 main）
```

**注意**：本地 AKEData 是 2026-09-08 的快照（仓库记录的同步版本是 2026-10-06 的 `e796ccc3`），本地全量重生成会**删掉**已提交的 `chr_0038_purrche`、`wpn_sword_0023` 等并产生大量无关漂移 → 一律走 CI，不要本地重生成。
（如需单文件核对，可用 `gh api repos/cmyyx/AKEData/contents/<path>` / `git/blobs/<sha>`；>1MB 的文件 contents API 不返回内容，要用 blob API。）

---

## 5. 验证

```bash
npx tsc --noEmit        # 0 错误
npx eslint              # 0 错误 0 警告
npx vitest run          # 210 文件 / 1428 测试全过
node scripts/check-i18n.mjs   # 无 P0/P1（新增 key 已补 zh-CN/en/ja/zh-TW）
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
