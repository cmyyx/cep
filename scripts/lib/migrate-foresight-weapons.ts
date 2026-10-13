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
  /** 已迁过 (id 已是正式 id) 的条目, 无需处理 */
  already: string[]
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
  const skipped: string[] = []
  // 迁移护栏: 不覆盖已存在的正式 id, 也不让两个前瞻条目撞到同一个 id
  const existingFormalIds = new Set([...content.matchAll(/\bid:\s*'(wpn_[^']+)'/g)].map((match) => match[1]))
  const plannedFormalIds = new Set<string>()

  for (const target of targets) {
    const lineIndex = lines.findIndex((line) => line.includes(`id: '${target.previewId}'`))
    if (lineIndex < 0) {
      if (existingFormalIds.has(target.formalId)) {
        already.push(`${target.formalId} (${target.name})`)
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
    lines[lineIndex] = lines[lineIndex].replace(`id: '${target.previewId}'`, `id: '${target.formalId}'`)
    existingFormalIds.add(target.formalId)
    plannedFormalIds.add(target.formalId)
    migrated.push({ previewId: target.previewId, formalId: target.formalId })
  }

  return { content: lines.join('\n'), migrated, already, skipped }
}

/** 读取 `src/data/weapons.ts`, 迁移 (updateMode) 或只报告。 */
export function migrateForesightWeapons(
  weaponsTsPath: string,
  targets: ForesightWeaponTarget[],
  updateMode: boolean,
): { migrated: ForesightMigrationResult['migrated']; already: string[]; skipped: string[] } {
  if (!existsSync(weaponsTsPath)) return { migrated: [], already: [], skipped: ['weapons.ts 不存在'] }
  const content = readFileSync(weaponsTsPath, 'utf-8')
  const result = migrateForesightWeaponsFile(content, targets)
  if (updateMode && result.migrated.length > 0) writeFileSync(weaponsTsPath, result.content, 'utf-8')
  return { migrated: result.migrated, already: result.already, skipped: result.skipped }
}
