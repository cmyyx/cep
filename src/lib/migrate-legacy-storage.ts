/**
 * 旧版前端 localStorage 数据迁移工具
 *
 * 从旧版 localStorage key `weapon-marks:v2` 读取标记数据,
 * 转换为新版 Zustand store 格式写入 `essence-settings`.
 */

import weaponNameIdMap from '@/data/weapon-name-id-map.json'

/** 旧版 marks 条目结构 */
interface LegacyMarkItem {
  weaponOwned?: boolean
  essenceOwned?: boolean
  note?: string
}

interface LegacyMarks {
  [weaponName: string]: LegacyMarkItem
}

/** 迁移结果 */
export interface MigrationResult {
  /** 成功迁移的武器拥有条目数 */
  ownershipCount: number
  /** 成功迁移的基质状态条目数 */
  essenceCount: number
  /** 成功迁移的备注条目数 */
  notesCount: number
  /** 未找到映射的武器名 */
  unmappedNames: string[]
  /** 跳过的无效条目数 */
  skippedCount: number
  /** 转换后的数据，可直接写入 Zustand store */
  data: {
    weaponOwnership: Record<string, boolean>
    essenceStatus: Record<string, boolean>
    weaponNotes: Record<string, string>
  } | null
}

const OLD_STORAGE_KEY = 'weapon-marks:v2'
const NEW_STORAGE_KEY = 'essence-settings'

/**
 * 检查是否存在旧版数据
 */
export function hasLegacyStorage(): boolean {
  try {
    return localStorage.getItem(OLD_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

/**
 * 执行旧→新迁移.
 *
 * 规则:
 * - 如果新版 store 已有数据, 旧版数据合并到新版 (新版优先)
 * - 如果新版 store 为空, 旧版数据直接写入
 */
export function migrateLegacyStorage(): MigrationResult | null {
  const result: MigrationResult = {
    ownershipCount: 0,
    essenceCount: 0,
    notesCount: 0,
    unmappedNames: [],
    skippedCount: 0,
    data: null,
  }

  try {
    if (!hasLegacyStorage()) return null

    const raw = localStorage.getItem(OLD_STORAGE_KEY)
    if (!raw) return null

    let marks: LegacyMarks
    try {
      marks = JSON.parse(raw)
    } catch {
      result.skippedCount = -1
      return result
    }

    if (!marks || typeof marks !== 'object') {
      result.skippedCount = -1
      return result
    }

    const weaponOwnership: Record<string, boolean> = {}
    const essenceStatus: Record<string, boolean> = {}
    const weaponNotes: Record<string, string> = {}

    for (const [weaponName, data] of Object.entries(marks)) {
      if (!data || typeof data !== 'object') {
        result.skippedCount++
        continue
      }

      const weaponId = (weaponNameIdMap as Record<string, string>)[weaponName]
      if (!weaponId) {
        result.unmappedNames.push(weaponName)
        continue
      }

      if (data.weaponOwned === true) {
        weaponOwnership[weaponId] = true
        result.ownershipCount++
      }
      if (data.essenceOwned === true) {
        essenceStatus[weaponId] = true
        result.essenceCount++
      }
      if (typeof data.note === 'string' && data.note.trim()) {
        weaponNotes[weaponId] = data.note.trim()
        result.notesCount++
      }
    }

    // 合并到现有 Zustand store 数据 (新版数据优先)
    let existing: Record<string, unknown> = {}
    try {
      const existingRaw = localStorage.getItem(NEW_STORAGE_KEY)
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw)
        if (parsed && typeof parsed === 'object' && parsed.state && typeof parsed.state === 'object') {
          existing = parsed.state as Record<string, unknown>
        }
      }
    } catch { /* ignore */ }

    const mergedOwnership: Record<string, boolean> = {
      ...weaponOwnership,
      ...(existing.weaponOwnership as Record<string, boolean> || {}),
    }
    const mergedEssence: Record<string, boolean> = {
      ...essenceStatus,
      ...(existing.essenceStatus as Record<string, boolean> || {}),
    }
    const mergedNotes: Record<string, string> = {
      ...weaponNotes,
      ...(existing.weaponNotes as Record<string, string> || {}),
    }

    // 返回转换后的数据，供调用方直接写入 Zustand store
    result.data = {
      weaponOwnership: mergedOwnership,
      essenceStatus: mergedEssence,
      weaponNotes: mergedNotes,
    }

    const newState = {
      state: {
        ...existing,
        weaponOwnership: mergedOwnership,
        essenceStatus: mergedEssence,
        weaponNotes: mergedNotes,
      },
      version: 0,
    }

    localStorage.setItem(NEW_STORAGE_KEY, JSON.stringify(newState))
    return result
  } catch {
    return null
  }
}

/**
 * 获取旧版 localStorage 中的所有相关 key
 */
export function getLegacyStorageKeys(): string[] {
  const legacyPatterns = [
    'weapon-marks:v2',
    'weapon-marks:v1',
    'weapon-marks-migration:v1',
    'excluded-notes:v1',
    'planner-ui-state:v1',
    'planner-attr-hint:v1',
    'weapon-attr-overrides:v1',
    'planner-custom-weapons:v1',
    'planner-editor-characters:v1',
    'planner-perf-mode:v1',
    'planner-theme-mode:v1',
    'planner-lang',
    'planner-bg-image:v1',
    'planner-bg-api:v1',
    'planner-bg-display:v1',
    'planner-bg-blur:v1',
    'announcement:skip',
  ]

  const result: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (legacyPatterns.includes(key)) {
        result.push(key)
      }
      if (key.startsWith('announcement:skip:')) {
        result.push(key)
      }
    }
  } catch { /* ignore */ }
  return result
}

/**
 * 清理所有旧版 localStorage 数据
 */
export function clearLegacyStorage(): { cleared: string[] } {
  const keys = getLegacyStorageKeys()
  for (const key of keys) {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  }
  return { cleared: keys }
}
