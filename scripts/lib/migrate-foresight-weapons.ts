// 前瞻武器的正式 ID 迁移。
// ================================================================================
// 客户端前瞻表 (`ForesightWeaponTable`) 已经给出**正式 id** + 多语言名 + 图标, 所以前瞻
// 武器和已上线武器走同一套迁移流程: 把 `src/data/weapons.ts` 里的 `preview:<名称>` 换成正式
// id, 唯一区别是**保留 `source: 'preview'`** (前瞻徽标 / 未上线状态靠它渲染)。
//
// 与 `updatePreviewWeapons` (sync-game-data.ts, 按 ItemTable 名字把已上线武器迁走) 的分工:
//   - 已上线: updatePreviewWeapons 迁移 id 并**移除** source: 'preview', 随后 updateWeaponsFile
//     补齐等级/突破/技能等上游字段。
//   - 仍前瞻: 这里迁移 id 并**保留** source, 其余字段等实装后由 updateWeaponsFile 接管。
//
// 迁移前会逐字段核查人工条目与上游是否一致 (名称 / 稀有度 / 武器类型 / 三个宝石标签);
// 任何一项对不上就不迁移, 只报告 —— 上游是唯一真源, 对不上说明人工条目写错了或匹配错了。
// ================================================================================

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/** 迁移目标 (由 `generate-foresight.ts` 的产物提供: 正式 id + 已解析的名字 + 上游字段)。 */
export interface ForesightWeaponTarget {
  formalId: string
  /** `src/data/weapons.ts` 里现在的临时 id (`preview:<名称>`) */
  previewId: string
  /** 上手游简中名 (`ForesightWeaponTable.name.id` → I18nTextTable_CN) */
  name: string
  /** 上游缺字段时为 null → 无法核查, 不迁移 */
  rarity: number | null
  weaponTypeId: string | null
  gemTagIds: string[]
  iconId: string
}

export interface ForesightMigrationResult {
  content: string
  /** 本次迁成正式 id 的条目 */
  migrated: Array<{ previewId: string; formalId: string }>
  /** 已迁过 (id 已是正式 id) 的条目 */
  already: string[]
  /** 原本没标前瞻状态、已补上 `source: 'preview'` 的条目 */
  repaired: string[]
  /** 需要人工处理: 找不到条目 / id 冲突 / 字段对不上 */
  skipped: string[]
}

/** CEP 前台条目的中文武器类型 (`src/types/matrix.ts` 的 `type`)。 */
const TYPE_NAME_BY_WEAPON_TYPE: Record<string, string> = {
  '1': '单手剑',
  '2': '施术单元',
  '3': '双手剑',
  '5': '长柄武器',
  '6': '手铳',
}

/** 给条目补上前瞻状态 (上游前瞻表里有 = 未上线), 返回补过的行。 */
function ensurePreviewSource(line: string): string {
  if (/source:\s*'preview'/.test(line)) return line
  // 行尾形如 `, chars: [...], },` / `, },` -> 插到收尾的 ` }` 之前
  const index = line.lastIndexOf(' }')
  if (index < 0) return line
  return `${line.slice(0, index)}, source: 'preview'${line.slice(index)}`
}

/**
 * 行首的 `id: 'xxx'` 字段匹配 (锚定, 不做子串包含)。
 *
 * `line.includes("id: 'wpn_x'")` 会误命中别的字段: 例如 `previewId: 'preview:唤月'`
 * 含子串 `id: 'preview:唤月'`; `[\`{,\`]` 前缀把它限定为对象的 id 字段。
 */
function lineId(line: string): string | null {
  const match = /(?:^|[{,]) *id: *'([^']*)'/.exec(line)
  return match ? match[1] : null
}

/** `gat_passive_attr_wisd` / `gst_passive_keyword` → 客户端 gemTagId (`attr_wisd` / `keyword`) */
function normalizeClientTag(cepTag: string): string {
  return cepTag.replace(/^ga?t_passive_/, '').replace(/^gst_passive_/, '')
}

function fieldOf(line: string, field: string): string | null {
  const match = new RegExp(`${field}:\\s*'([^']*)'`).exec(line)
  return match ? match[1] : null
}

/** 逐字段核查人工条目与上游是否一致; 返回不一致清单 (空数组 = 可以迁移)。 */
function verifyEntry(line: string, target: ForesightWeaponTarget): string[] {
  const problems: string[] = []
  if (target.rarity === null) problems.push('上游缺 rarity — 无法核查')
  if (target.weaponTypeId === null) problems.push('上游缺 wpnType — 无法核查')
  if (target.name.length === 0) problems.push('上游缺名字 — 无法核查')
  if (problems.length > 0) return problems

  const name = fieldOf(line, 'name')
  if (name !== target.name) problems.push(`name: 条目 "${name ?? '<缺>'}" ≠ 上游 "${target.name}"`)

  const rarity = /rarity:\s*(\d+)/.exec(line)?.[1]
  if (rarity !== String(target.rarity)) problems.push(`rarity: 条目 ${rarity ?? '<缺>'} ≠ 上游 ${target.rarity}`)

  const type = fieldOf(line, 'type')
  const expectedType = target.weaponTypeId === null ? undefined : TYPE_NAME_BY_WEAPON_TYPE[target.weaponTypeId]
  if (expectedType && type !== expectedType) problems.push(`type: 条目 "${type ?? '<缺>'}" ≠ 上游 "${expectedType}"`)

  const entryTags = ['primaryStat', 'elementalDamage', 'specialAbility']
    .map((field) => fieldOf(line, field))
    .filter((tag): tag is string => tag !== null)
    .map(normalizeClientTag)
    .sort()
  const expectedTags = [...target.gemTagIds].sort()
  if (entryTags.join('|') !== expectedTags.join('|')) {
    problems.push(`gemTagIds: 条目 [${entryTags.join(',')}] ≠ 上游 [${expectedTags.join(',')}]`)
  }
  return problems
}

/**
 * 把 `content` 里的前瞻条目迁到正式 id。纯函数 (不碰文件系统), 便于 fixture 测试。
 */
export function migrateForesightWeaponsFile(content: string, targets: ForesightWeaponTarget[]): ForesightMigrationResult {
  const lines = content.split('\n')
  const migrated: Array<{ previewId: string; formalId: string }> = []
  const already: string[] = []
  const repairedIds: string[] = []
  const skipped: string[] = []
  // 迁移护栏: 不覆盖已存在的正式 id, 也不让两个前瞻条目撞到同一个 id
  const existingFormalIds = new Set(lines.map(lineId).filter((id): id is string => id !== null && id.startsWith('wpn_')))
  const plannedFormalIds = new Set<string>()

  for (const target of targets) {
    // 已迁移 (条目 id 就是正式 id): 只确认前瞻状态还在, 不重复迁移也不报冲突
    if (target.previewId === target.formalId) {
      const formalIndex = lines.findIndex((line) => lineId(line) === target.formalId)
      if (formalIndex < 0) {
        skipped.push(`${target.formalId}: weapons.ts 里找不到该条目`)
        continue
      }
      already.push(`${target.formalId} (${target.name})`)
      const repaired = ensurePreviewSource(lines[formalIndex])
      if (repaired !== lines[formalIndex]) {
        lines[formalIndex] = repaired
        repairedIds.push(target.formalId)
      }
      continue
    }
    const lineIndex = lines.findIndex((line) => lineId(line) === target.previewId)
    if (lineIndex < 0) {
      if (existingFormalIds.has(target.formalId)) {
        already.push(`${target.formalId} (${target.name})`)
        // 已用正式 id 但漏标前瞻状态 -> 补上 (上游前瞻表是唯一真源)
      const formalIndex = lines.findIndex((line) => lineId(line) === target.formalId)
        if (formalIndex >= 0) {
          const repaired = ensurePreviewSource(lines[formalIndex])
          if (repaired !== lines[formalIndex]) {
            lines[formalIndex] = repaired
            repairedIds.push(target.formalId)
          }
        }
      } else {
        skipped.push(`${target.previewId}: weapons.ts 里找不到该条目, 也没有 ${target.formalId}`)
      }
      continue
    }
    if (existingFormalIds.has(target.formalId) || plannedFormalIds.has(target.formalId)) {
      skipped.push(`${target.previewId}: 正式 id ${target.formalId} 已被占用 — 需人工确认`)
      continue
    }
    const problems = verifyEntry(lines[lineIndex], target)
    if (problems.length > 0) {
      skipped.push(`${target.previewId}: 与上游不一致 (${problems.join('; ')}) — 未迁移`)
      continue
    }
    const beforeSource = lines[lineIndex]
    lines[lineIndex] = ensurePreviewSource(beforeSource.replace(`id: '${target.previewId}'`, `id: '${target.formalId}'`))
    if (!/source:\s*'preview'/.test(beforeSource)) repairedIds.push(target.formalId)
    existingFormalIds.add(target.formalId)
    plannedFormalIds.add(target.formalId)
    migrated.push({ previewId: target.previewId, formalId: target.formalId })
  }

  return { content: lines.join('\n'), migrated, already, repaired: repairedIds, skipped }
}

/** 读取 `src/data/weapons.ts`, 迁移 (updateMode) 或只报告。 */
export function migrateForesightWeapons(
  weaponsTsPath: string,
  targets: ForesightWeaponTarget[],
  updateMode: boolean,
): { migrated: ForesightMigrationResult['migrated']; already: string[]; repaired: string[]; skipped: string[] } {
  if (!existsSync(weaponsTsPath)) return { migrated: [], already: [], repaired: [], skipped: ['weapons.ts 不存在'] }
  const content = readFileSync(weaponsTsPath, 'utf-8')
  const result = migrateForesightWeaponsFile(content, targets)
  if (updateMode && (result.migrated.length > 0 || result.repaired.length > 0)) {
    writeFileSync(weaponsTsPath, result.content, 'utf-8')
  }
  return { migrated: result.migrated, already: result.already, repaired: result.repaired, skipped: result.skipped }
}
