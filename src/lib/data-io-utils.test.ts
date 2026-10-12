// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import type { useTranslations } from 'next-intl'
import {
  countItems,
  extractReadIds,
  getIoModules,
  getKnownModuleIds,
  MAX_ITEMS_PER_MODULE,
  projectEssenceSettingsForExport,
  readModule,
} from './data-io-utils'

/** Echoes the key back so tests can assert which i18n key a module uses. */
const t = ((key: string) => key) as unknown as ReturnType<typeof useTranslations>

describe('getIoModules', () => {
  it('covers every persisted planner module', () => {
    const byId = new Map(getIoModules(t).map((m) => [m.id, m]))

    // Regression: growth planner + panel preview were missing, so a backup /
    // restore round-trip silently dropped both planners.
    expect(byId.get('growth-planner')?.key).toBe('growthPlanner')
    expect(byId.get('panel-preview')?.key).toBe('panelPreview')
    expect(byId.get('essence-settings')?.key).toBe('essence-settings')
    expect(byId.get('matrix-session')?.key).toBe('matrix-session')
    expect(byId.get('refinement-session')?.key).toBe('refinement-session')
  })

  it('gives every module a label and an item limit', () => {
    for (const mod of getIoModules(t)) {
      expect(mod.label, mod.id).toBeTruthy()
      expect(MAX_ITEMS_PER_MODULE[mod.id], mod.id).toBeGreaterThan(0)
    }
  })

  it('whitelists exactly the declared module ids', () => {
    expect([...getKnownModuleIds(t)].sort()).toEqual(getIoModules(t).map((m) => m.id).sort())
  })
})

describe('countItems: growth-planner', () => {
  it('counts active and cached configs', () => {
    expect(countItems('growth-planner', {
      configs: [{ kind: 'character', id: 'a' }, { kind: 'weapon', id: 'b' }],
      removedConfigs: [{ kind: 'character', id: 'c' }],
    })).toBe(3)
  })

  it('returns 0 for an empty or malformed payload', () => {
    expect(countItems('growth-planner', { configs: [], removedConfigs: [] })).toBe(0)
    expect(countItems('growth-planner', { configs: 'nope' })).toBe(0)
    expect(countItems('growth-planner', null)).toBe(0)
  })
})

describe('countItems: panel-preview', () => {
  it('counts a config with a character as one item', () => {
    expect(countItems('panel-preview', { config: { characterId: 'chr_0001', level: 90 } })).toBe(1)
  })

  it('returns 0 without a usable config', () => {
    expect(countItems('panel-preview', { config: null })).toBe(0)
    expect(countItems('panel-preview', { config: {} })).toBe(0)
    expect(countItems('panel-preview', {})).toBe(0)
  })
})

describe('extractReadIds', () => {
  it('reads the current { readIds } shape', () => {
    expect(extractReadIds({ readIds: ['a', 'b'] })).toEqual(['a', 'b'])
  })

  it('accepts the legacy { ids } and bare-array shapes', () => {
    expect(extractReadIds({ ids: ['a'] })).toEqual(['a'])
    expect(extractReadIds(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('drops non-string entries and unknown shapes', () => {
    expect(extractReadIds({ readIds: ['a', 1, null, { id: 'b' }] })).toEqual(['a'])
    expect(extractReadIds({ nope: true })).toEqual([])
    expect(extractReadIds(null)).toEqual([])
  })
})

describe('readModule', () => {
  beforeEach(() => localStorage.clear())

  it('unwraps the zustand persist envelope of the new planner modules', () => {
    localStorage.setItem('growthPlanner', JSON.stringify({
      state: { configs: [{ kind: 'character', id: 'a' }], removedConfigs: [] },
      version: 2,
    }))
    localStorage.setItem('panelPreview', JSON.stringify({
      state: { config: { characterId: 'chr_0001' } },
      version: 4,
    }))

    expect(countItems('growth-planner', readModule('growthPlanner'))).toBe(1)
    expect(countItems('panel-preview', readModule('panelPreview'))).toBe(1)
  })

  it('returns null for missing or corrupt entries', () => {
    expect(readModule('growthPlanner')).toBeNull()
    localStorage.setItem('panelPreview', '{oops')
    expect(readModule('panelPreview')).toBeNull()
  })
})

describe('countItems: essence-settings', () => {
  it('counts every account mark, not only the active-account mirror', () => {
    const data = {
      // the active-account mirror duplicates accounts[active] — it must not be added twice
      weaponOwnership: { wpn_claym_0017: true },
      essenceStatus: { wpn_claym_0017: true },
      weaponNotes: { wpn_claym_0017: 'x' },
      accounts: [
        { id: 'a', name: 'A', weaponOwnership: { wpn_claym_0017: true }, essenceStatus: { wpn_claym_0017: true }, weaponNotes: { wpn_claym_0017: 'x' } },
        { id: 'b', name: 'B', weaponOwnership: { wpn_sword_0012: true, wpn_lance_0010: true }, essenceStatus: {}, weaponNotes: {} },
      ],
    }

    expect(countItems('essence-settings', data)).toBe(5)
  })

  it('falls back to the flat marks of a legacy payload without accounts', () => {
    expect(countItems('essence-settings', {
      weaponOwnership: { wpn_claym_0017: true },
      essenceStatus: { wpn_sword_0012: true },
      weaponNotes: { wpn_claym_0017: 'x' },
    })).toBe(3)
  })
})

describe('projectEssenceSettingsForExport', () => {
  it('drops the duplicated active-account mirror and keeps everything else', () => {
    const projected = projectEssenceSettingsForExport({
      accounts: [{ id: 'a', name: 'A', weaponOwnership: { wpn_claym_0017: true }, essenceStatus: {}, weaponNotes: {} }],
      activeAccountId: 'a',
      weaponOwnership: { wpn_claym_0017: true },
      essenceStatus: { wpn_sword_0012: true },
      weaponNotes: { wpn_claym_0017: 'x' },
      customWeapons: [],
      regionFirst: 'r1',
      hideFourStarWeaponsList: true,
      autoSyncEnabled: false,
    })

    expect(projected).not.toBeNull()
    expect(projected?.accounts).toHaveLength(1)
    expect(projected?.activeAccountId).toBe('a')
    expect(projected?.regionFirst).toBe('r1')
    expect(projected?.hideFourStarWeaponsList).toBe(true)
    expect(projected?.autoSyncEnabled).toBe(false)
    expect('weaponOwnership' in (projected ?? {})).toBe(false)
    expect('essenceStatus' in (projected ?? {})).toBe(false)
    expect('weaponNotes' in (projected ?? {})).toBe(false)
  })

  it('returns null when there is nothing to export', () => {
    expect(projectEssenceSettingsForExport(null)).toBeNull()
    expect(projectEssenceSettingsForExport('nope')).toBeNull()
  })
})
