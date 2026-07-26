// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import type { useTranslations } from 'next-intl'
import {
  countItems,
  extractReadIds,
  getIoModules,
  getKnownModuleIds,
  MAX_ITEMS_PER_MODULE,
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
