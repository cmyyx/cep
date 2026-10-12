/**
 * 数据导入模块分发层（无 React 依赖）。
 *
 * Every branch MUST write through the live Zustand store, not just
 * localStorage: a store that is already mounted keeps its own (now stale) copy
 * and re-persists it on the next `set()`, silently reverting the import.
 *
 * The growth-planner / panel-preview stores are loaded lazily because their
 * modules kick off `loadPlannerData()` (a multi-MB dynamic import) at module
 * scope — a static import would pull that onto the settings route.
 */

import { useMatrixStore } from '@/stores/useMatrixStore'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useAnnouncementStore } from '@/stores/useAnnouncementStore'
import { sanitizeObject, extractReadIds } from '@/lib/data-io-utils'
import { applyCepEssenceSettings, type CepEssenceImportOptions } from '@/lib/essence-import/apply'
import { detectImportKind, type ImportKind } from '@/lib/essence-import/detect'
import type { MaaEndEssenceSummary } from '@/lib/essence-import/maamend'
import type { GrowthConfig, PanelPreviewConfig } from '@/types/planner'

/** Parsed CEP export envelope. */
export interface ImportFile {
  version: number
  exportedAt: string
  appVersion?: string
  device?: { platform?: string; userAgent?: string }
  modules: Record<string, unknown>
}

export interface ImportModuleOptions {
  /** Account handling for the `essence-settings` module (see applyCepEssenceSettings). */
  essence?: CepEssenceImportOptions
}

/**
 * Detected format + parsed payload of a picked / dropped file.
 *
 * Parsing happens before the dialog opens so the dialog itself never has to
 * pull the MaaEND validator (zod) into the global bundle.
 */
export interface PreparedImport {
  /** null when neither a CEP backup nor a MaaEND inventory matched. */
  kind: ImportKind | null
  /** Parsed CEP envelope; only for kind === 'cep-backup'. */
  file: ImportFile | null
  /** Parsed MaaEND inventory; only for kind === 'maamend-essence'. */
  inventory: MaaEndEssenceSummary | null
}

/** Sniff the format and parse accordingly (never throws). */
export async function prepareImport(json: unknown): Promise<PreparedImport> {
  const kind = detectImportKind(json)
  if (kind === 'cep-backup') {
    return { kind, file: validateImportFile(json), inventory: null }
  }
  if (kind === 'maamend-essence') {
    // Lazy: zod is otherwise only used by the login / oauth routes, and this
    // module is reachable from the globally mounted import dialog.
    const { parseMaaEndEssence } = await import('@/lib/essence-import/maamend')
    return { kind, file: null, inventory: parseMaaEndEssence(json) }
  }
  return { kind: null, file: null, inventory: null }
}

/** Validate the CEP export envelope; null when the payload is not one. */
export function validateImportFile(json: unknown): ImportFile | null {
  if (!json || typeof json !== 'object') return null
  const obj = json as Record<string, unknown>
  if (typeof obj.version !== 'number' || obj.version < 1) return null
  if (!obj.modules || typeof obj.modules !== 'object') return null
  return {
    version: obj.version,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
    appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : undefined,
    device: obj.device && typeof obj.device === 'object'
      ? (obj.device as { platform?: string; userAgent?: string })
      : undefined,
    modules: obj.modules as Record<string, unknown>,
  }
}

/** Upper bound for a picked / dropped import file. Real exports are a few hundred KB. */
export const MAX_IMPORT_FILE_BYTES = 16 * 1024 * 1024

export type ReadJsonFileResult =
  | { ok: true; json: unknown }
  | { ok: false; errorKey: string }

/**
 * Read a picked / dropped file as JSON.
 *
 * Failures resolve to an i18n key instead of throwing so both entry points
 * (file picker, global drop overlay) share the same toast copy.
 */
export function readJsonFile(file: File): Promise<ReadJsonFileResult> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return Promise.resolve({ ok: false, errorKey: 'settings.importFileTooLarge' })
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve({ ok: true, json: JSON.parse(String(reader.result)) })
      } catch {
        resolve({ ok: false, errorKey: 'settings.importParseError' })
      }
    }
    reader.onerror = () => resolve({ ok: false, errorKey: 'settings.importReadError' })
    reader.readAsText(file)
  })
}

/** Apply one module of an import file. */
export async function importModule(
  moduleId: string,
  rawData: unknown,
  options?: ImportModuleOptions,
): Promise<void> {
  const data = sanitizeObject(rawData)
  if (data === null || data === undefined || typeof data !== 'object') return

  switch (moduleId) {
    case 'essence-settings': {
      // Accounts + marks + global preferences are applied through store actions
      // so the persist mirror stays consistent (localStorage-only writes lose to
      // this store's next persist write, and hydration then reverts the import).
      applyCepEssenceSettings(data, options?.essence)
      break
    }
    case 'matrix-session': {
      const payload = { state: data, version: 0 }
      localStorage.setItem('matrix-session', JSON.stringify(payload))
      const d = data as Record<string, unknown>
      useMatrixStore.setState({
        selectedWeaponIds: (Array.isArray(d.selectedWeaponIds) ? d.selectedWeaponIds : []) as string[],
        dungeonS1Selections: (d.dungeonS1Selections ?? {}) as Record<string, string[]>,
        expandedPlanKeys: (Array.isArray(d.expandedPlanKeys) ? d.expandedPlanKeys : []) as string[],
        selectedRegions: (Array.isArray(d.selectedRegions) ? d.selectedRegions : []) as string[],
        selectedSubRegions: (Array.isArray(d.selectedSubRegions) ? d.selectedSubRegions : []) as string[],
        plansStale: true,
      })
      useMatrixStore.getState().computePlans()
      break
    }
    case 'refinement-session': {
      const payload = { state: data, version: 0 }
      localStorage.setItem('refinement-session', JSON.stringify(payload))
      const d = data as Record<string, unknown>
      useRefinementStore.setState({
        selectedEquipId: (d.selectedEquipId as string) ?? null,
        collapsedSets: (d.collapsedSets as Record<string, boolean>) ?? {},
        filterSub1: (Array.isArray(d.filterSub1) ? d.filterSub1 : []) as string[],
        filterSub2: (Array.isArray(d.filterSub2) ? d.filterSub2 : []) as string[],
        filterSpecial: (Array.isArray(d.filterSpecial) ? d.filterSpecial : []) as string[],
        filterCollapsed: (d.filterCollapsed as boolean) ?? true,
        filterMaterial: (Array.isArray(d.filterMaterial) ? d.filterMaterial : []) as string[],
        expandedRecommendations: (d.expandedRecommendations as Record<string, boolean>) ?? {},
      })
      break
    }
    case 'growth-planner': {
      const d = data as Record<string, unknown>
      const configs = (Array.isArray(d.configs) ? d.configs : []) as GrowthConfig[]
      const removedConfigs = (Array.isArray(d.removedConfigs) ? d.removedConfigs : []) as GrowthConfig[]
      const { useGrowthPlannerStore } = await import('@/stores/useGrowthPlannerStore')
      // persist writes storage itself (correct name + schema version) on set().
      useGrowthPlannerStore.setState({ configs, removedConfigs })
      // Drops entries for unknown entities; no-op until planner data has loaded.
      useGrowthPlannerStore.getState().pruneInvalid()
      break
    }
    case 'panel-preview': {
      const d = data as Record<string, unknown>
      const config = d.config && typeof d.config === 'object'
        ? (d.config as PanelPreviewConfig)
        : null
      const { usePanelPreviewStore } = await import('@/stores/usePanelPreviewStore')
      usePanelPreviewStore.setState({ config })
      usePanelPreviewStore.getState().pruneInvalid()
      break
    }
    case 'cep-settings': {
      localStorage.setItem('cep-settings', JSON.stringify(data))
      useSettingsStore.getState().hydrateFromStorage()
      break
    }
    case 'editor-drafts': {
      const payload = { state: data, version: 0 }
      localStorage.setItem('cep-editor-drafts', JSON.stringify(payload))
      break
    }
    case 'announcement-read': {
      // localStorage-only writes lose to the store's in-memory readIds on the
      // next set() — go through the store so persist rewrites the key for us.
      useAnnouncementStore.setState({ readIds: extractReadIds(data) })
      break
    }
  }
}