/**
 * 数据导入/导出共享工具
 *
 * 模块定义、统一计数、摘要生成 — DataExporter 与 DataImporter 共用。
 */

import type { useTranslations } from 'next-intl'

export interface IoModule {
  id: string
  key: string
  label: string
}

export function getIoModules(t: ReturnType<typeof useTranslations>): IoModule[] {
  return [
    { id: 'essence-settings', key: 'essence-settings', label: t('dataCleaner.modules.essence-settings.label') },
    { id: 'matrix-session', key: 'matrix-session', label: t('dataCleaner.modules.matrix-session.label') },
    { id: 'refinement-session', key: 'refinement-session', label: t('dataCleaner.modules.refinement-session.label') },
    { id: 'cep-settings', key: 'cep-settings', label: t('dataCleaner.modules.cep-settings.label') },
    { id: 'editor-drafts', key: 'cep-editor-drafts', label: t('dataCleaner.modules.editor-drafts.label') },
    { id: 'announcement-read', key: 'cep-announcement-read-ids', label: t('dataCleaner.modules.announcement-read.label') },
  ]
}

/** 统计模块实质性条目数。返回 0 表示无有效内容。 */
export function countItems(moduleId: string, data: unknown): number {
  if (data === null || data === undefined || typeof data !== 'object') return 0

  switch (moduleId) {
    case 'essence-settings': {
      const d = data as Record<string, unknown>
      const ow = Object.keys((d.weaponOwnership as object) ?? {}).length
      const es = Object.keys((d.essenceStatus as object) ?? {}).length
      const wn = Object.keys((d.weaponNotes as object) ?? {}).length
      const cw = Array.isArray(d.customWeapons) ? d.customWeapons.length : 0
      const flagKeys = ['hideEssenceOwnedWeaponsList','hideUnownedWeaponsList','hideFourStarWeaponsList','hideThreeStarWeaponsList','onlyHideWhenBothOwnedList','enableOwnershipEditList','enableNotesList','hideEssenceOwnedWeaponsPlans','hideUnownedWeaponsPlans','hideFourStarWeaponsPlans','hideThreeStarWeaponsPlans','onlyHideWhenBothOwnedPlans','enableOwnershipEditPlans','enableNotesPlans','keepUpVisibleList','keepUpVisiblePlans']
      let flags = 0
      for (const k of flagKeys) { if (d[k] === true) flags++ }
      const regions = (d.regionFirst || d.regionSecond) ? 1 : 0
      return ow + es + wn + cw + flags + regions
    }
    case 'matrix-session': {
      const d = data as Record<string, unknown>
      const ids = Array.isArray(d.selectedWeaponIds) ? d.selectedWeaponIds.length : 0
      const s1 = Object.keys((d.dungeonS1Selections as object) ?? {}).length
      const reg = Array.isArray(d.selectedRegions) ? d.selectedRegions.length : 0
      const sub = Array.isArray(d.selectedSubRegions) ? d.selectedSubRegions.length : 0
      return ids + s1 + reg + sub
    }
    case 'refinement-session': {
      const d = data as Record<string, unknown>
      const equip = d.selectedEquipId ? 1 : 0
      const sets = Object.keys((d.collapsedSets as object) ?? {}).length
      return equip + sets
    }
    case 'cep-settings': {
      const d = data as Record<string, unknown>
      let count = 0
      if (d.theme && d.theme !== 'auto') count++
      if (d.backgroundEnabled === false) count++
      if (d.backgroundBlur === false) count++
      if (typeof d.backgroundUrl === 'string' && d.backgroundUrl.length > 0) count++
      return count
    }
    case 'editor-drafts': {
      if (Array.isArray(data)) return data.length
      const d = data as Record<string, unknown> | null
      if (d) {
        const arr = d.drafts ?? d.items ?? d.data
        if (Array.isArray(arr)) return arr.length
        return Object.keys(d).length
      }
      return 0
    }
    case 'announcement-read': {
      const d = data as Record<string, unknown> | null
      if (d) {
        const ids = d.readIds ?? d.ids ?? d
        if (Array.isArray(ids)) return ids.length
      }
      return 0
    }
    default:
      return Object.keys(data as object).length
  }
}

/** 模块白名单 — 导入时只接受这些 ID。 */
export function getKnownModuleIds(t: ReturnType<typeof useTranslations>): Set<string> {
  return new Set(getIoModules(t).map((m) => m.id))
}

/** 每个模块的条目数上限，超过则跳过该模块。 */
export const MAX_ITEMS_PER_MODULE: Record<string, number> = {
  'essence-settings': 10000,
  'matrix-session': 5000,
  'refinement-session': 500,
  'cep-settings': 100,
  'editor-drafts': 500,
  'announcement-read': 500,
}

/**
 * 递归消毒导入数据：移除原型污染 key、截断超深嵌套。
 * JSON.parse 本身不会产生函数/undefined，只需防 __proto__ 注入。
 */
export function sanitizeObject(obj: unknown, maxDepth: number = 20): unknown {
  if (maxDepth <= 0) return null
  if (Array.isArray(obj)) {
    return obj.map((v) => sanitizeObject(v, maxDepth - 1))
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
      result[k] = sanitizeObject(v, maxDepth - 1)
    }
    return result
  }
  return obj
}

export function buildSummary(moduleId: string, data: unknown, t: ReturnType<typeof useTranslations>): string {
  const n = countItems(moduleId, data)
  return n > 0 ? t('settings.importSummaryItems', { count: n }) : t('settings.importSummaryEmpty')
}

/** 从 localStorage 读取模块数据，自动解包 Zustand persist {state:...} 格式。 */
export function readModule(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'state' in parsed) {
      return parsed.state
    }
    return parsed
  } catch {
    return null
  }
}
