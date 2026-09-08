# 武器获取来源数据

## 目的

武器获取来源同时服务于三个场景：

1. Essence Planner 按来源大类隐藏武器；
2. 武器 Tooltip 显示来源大类；
3. WIKI 展示武器的全部具体来源。

来源数据由 AKEData 自动提取，项目数据中只保存来源 ID，不内嵌多语言文本。

## 武器数据字段

现有 `source?: 'game' | 'preview'` 字段保持原语义，不表示获取方式，也不重命名。

新增字段：

```ts
acquisitionSources?: Array<{
  categoryId: string
  sourceId: string
}>
```

### `categoryId`

来源大类 ID，用于 Tooltip 和隐藏筛选：

| ID | 默认含义 |
|---|---|
| `gacha` | 武器抽取 |
| `shop` | 商店兑换 |
| `battlePass` | 通行证 |
| `explore` | 探索 |
| `activity` | 活动 |
| `chest` | 自选箱 |
| `unknown` | 未分类来源（仅展示兜底，不可隐藏） |

类型保持开放字符串，以便上游未来新增来源大类时无需先修改 TypeScript 联合类型。

设计约束：

- 不生成 `reward` 分类。`RewardTable` 中的奖励几乎覆盖所有武器且名称即武器名，属于纯噪音；RewardTable 仅作为商店/自选箱的反向武器引用查询表。
- `unknown` 不是可隐藏分类。没有来源数据的武器（自定义武器、Preview 武器）不参与来源隐藏过滤，"未知"只是展示文案（`wiki.unknownAcquisitionSource` / `essenceSettings.acquisitionCategory.unknown`）。
- 隐藏筛选的候选分类由当前武器数据推导（`acquisitionCategoryIds()`），排序固定为 gacha > shop > activity > battlePass > explore > chest。

### `sourceId`

具体来源记录的稳定 ID，不是展示文本，也不包含多语言内容。

来源记录粒度：

| 来源 | `sourceId` 使用字段 |
|---|---|
| `SystemJumpTable` 直接获取入口 | `obtainWayId` |
| 武器抽取 | `GachaWeaponPoolTable` / `GachaWeaponPoolContentTable` 的 pool ID |
| 商店具体商品 | `ShopGoodsTable.goodsId` |
| 自选箱 | `UsableItemChestTable` 的 chest ID |


当前上游快照中 `ItemTable.obtainWayIds` 的正式武器入口 ID 为：

```text
item_obtain_payshop_weapon
item_obtain_bp
item_obtain_explore
item_obtain_activity
```

当前抽取池 `sourceId` 示例：

```text
rerun_wpn_yvonne
weaponbox_constant_1
weaponbox_constant_2
weaponbox_constant_3
weaponbox_constant_4
weaponbox_constant_5
weponbox_1_0_1
weponbox_1_0_2
weponbox_1_0_3
weponbox_1_1_1
weponbox_1_1_2
weponbox_1_2_1
weponbox_1_2_2
weponbox_1_2_3
weponbox_1_3_1
weponbox_1_3_2
weponbox_1_4_1
weponbox_1_4_2
weponbox_1_5_1
```

注意：`GachaWeaponPoolTable` 与 `GachaWeaponPoolContentTable` 共用这些池 ID，属于同一来源记录，不生成重复来源。商店使用 `ShopGoodsTable.goodsId`，而不是重复使用父级 `shopId`。
同一个来源可以被多把武器复用。商店的 `shopId` 只作为上级商店分组，不能替代具体商品的 `goodsId`，因为同一商店下的商品价格、奖励和刷新规则可能不同。

## 上游表映射

```text
AKEData/TableCfg/ItemTable.json
  └─ obtainWayIds                 直接获取入口

AKEData/TableCfg/SystemJumpTable.json
  └─ desc / iconId / phaseId      获取入口解释和跳转信息

AKEData/TableCfg/GachaWeaponPoolTable.json
  └─ name / loopRewardShowTitle   武器池名称和赠礼说明

AKEData/TableCfg/GachaWeaponPoolContentTable.json
  └─ itemId / randomWeight         武器池内容

AKEData/TableCfg/ShopGoodsTable.json
  └─ goodsId / shopId / rewardId   具体商店商品
     weaponGachaPoolId / relatedWeaponGachPoolId
                                  商品关联的武器池

AKEData/TableCfg/ShopTable.json
  └─ shopGroupId / shopName        上级商店记录

AKEData/TableCfg/ShopGroupTable.json
  └─ shopGroupName                 商店大类名称

AKEData/TableCfg/RewardTable.json
  └─ rewardId / itemBundles         奖励内容（仅用于商店/自选箱反向查询，不生成来源）

AKEData/TableCfg/UsableItemChestTable.json
  └─ chest ID / rewardIdList        自选箱内容
```

## i18n 规则

来源数据不保存 `name`、`description` 或 `i18nKey` 字段。

生成脚本把来源名称和说明写入：

```text
src/generated/i18n/wikiData/zh-CN.json
src/generated/i18n/wikiData/en.json
src/generated/i18n/wikiData/ja.json
src/generated/i18n/wikiData/zh-TW.json
```

来源大类和具体来源的查找路径由 `categoryId` 与 `sourceId` 计算，不写入武器数据。来源文本使用现有 `wikiTextKey()` / `useWikiTranslations().text()` 机制。

文本回溯优先使用上游记录的多语言 `TextRef`：武器池使用 `name` / `loopRewardShowTitle`；商店商品没有独立名称字段时，依次使用关联武器池名称、商品奖励中的武器名称、`ShopGroupTable.shopGroupName`。这样不会把 `sourceId` 拼入展示文本，同时仍保留 `sourceId` 作为稳定的具体来源标识。来源内容在同一 `categoryId/sourceId` 下出现不一致时由 `addDetail()` 记录冲突警告。

## Wiki 展示

武器详情页的获取来源区块（`WikiAcquisitionList`，客户端 island）按分类分组、两列网格渲染，默认折叠：只显示前 2 个分类分组、共 6 条来源，剩余来源通过"还有 N 条来源"按钮展开。文本在服务端解析后以字符串传入 island，island 只负责展开/收起交互。

## Preview 与无来源武器

Preview 武器可以保留现有：

```ts
source: 'preview'
```

如果官方已经公开了预计的游戏内获取方式，可以手动补充 `acquisitionSources`。手动配置不会产生 `manual` 来源类型，来源类型仍然是 `gacha`、`shop` 等游戏内类型。
例如：
```ts
{ id: 'preview:点心时刻', name: '点心时刻', ...,
  acquisitionSources: [{ categoryId: 'shop', sourceId: 'item_obtain_payshop_weapon' }],
  source: 'preview' }
```
这里只能填写已知的游戏内 `categoryId/sourceId`；不要写 `name`、`description` 或 `i18nKey`。同步时 Preview 记录不参与 AKEData 正式武器来源一致性比较。

如果没有任何已知获取方式：

```ts
acquisitionSources: []
```

界面显示：

```text
游戏内来源：未知
```

正式武器没有来源时由同步校验报告；Preview 武器没有来源属于允许状态。

## 自动同步与校验

现有每日 CI 使用 `cmyyx/AKEData` fork 作为同步入口。同步流程负责：

1. 自动提取所有正式武器的来源关系；
2. 合并抽取池元数据和抽取池内容；
3. 解析商店、自选箱的反向武器引用；
4. 生成来源数据和 `wikiData` 多语言文件；
5. 校验来源引用的武器 ID 是否存在；
6. 校验来源入口和多语言文本是否存在；
7. 发现新来源时保留来源 ID并报告未分类项，不静默丢弃。

### Preview 武器自动转正

上游实装后，同步按中文名把 `preview:武器名` 行替换为正式 `wpn_*` id，并在同一次运行中用上游值覆盖 name/rarity/type/属性/`acquisitionSources`（只保留人工维护的 `chars` 与注释）。因此手动补充的来源即使填错或填少，也会在转正时被上游数据自动修正；用户 localStorage 中的旧 preview id 由 `resolve-weapon-id.ts` 按名称迁移。

自动转正带有防误替换守卫，命中以下任一情况时跳过并输出告警，等待人工处理：

- 上游存在同名武器的歧义（一个名字对应多个 `wpn_*`）；
- 目标正式 id 已存在于 weapons.ts（避免产生重复 id 行）；
- 多条 preview 行指向同一正式 id。

## Wiki 生成数据与 i18n 分离

Wiki 结构数据文件（`src/generated/data/wiki/**`）不保存 `LocalizedText` 多语言对象。

结构文件只保存：实体 ID、数值、图标 ID、来源关系和上游关联所需的结构字段。

多语言文本统一写入 `src/generated/i18n/**`，运行时通过实体 ID、技能 ID、来源 ID 等已有结构 ID 计算 `wikiData` 查询路径。服务端在 `src/lib/wiki-data.ts` 按当前 locale 恢复详情文本；客户端通过 `useWikiTranslations()` 或 `getGameI18nCatalog()` 查询。

因此不要向生成数据添加 `name: LocalizedText`、`description: LocalizedText` 或额外的 `i18nKey` 字段。新增文本应在生成器中加入对应的 `wikiData` catalog 条目，并由现有加载机制读取。
