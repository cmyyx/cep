import { beforeEach, expect, it } from 'vitest'
import { useWikiStore } from './useWikiStore'

beforeEach(() => {
  useWikiStore.setState({ expandedEquipmentGroups: [], hasStoredExpansion: false })
})

it('toggles equipment group expansion without affecting other groups', () => {
  const store = useWikiStore.getState()

  store.toggleEquipmentGroup('independent')
  store.toggleEquipmentGroup('set-a')
  expect(useWikiStore.getState().expandedEquipmentGroups).toEqual(['independent', 'set-a'])

  useWikiStore.getState().toggleEquipmentGroup('independent')
  expect(useWikiStore.getState().expandedEquipmentGroups).toEqual(['set-a'])
})

it('starts without a stored choice so the list can apply its first-visit defaults', () => {
  expect(useWikiStore.getState().hasStoredExpansion).toBe(false)

  useWikiStore.getState().toggleEquipmentGroup('set-a')
  expect(useWikiStore.getState().hasStoredExpansion).toBe(true)
})

it('replaces the whole expansion list for expand-all / collapse-all', () => {
  useWikiStore.getState().setExpandedEquipmentGroups(['set-a', 'set-b', 'set-c'])
  expect(useWikiStore.getState().expandedEquipmentGroups).toEqual(['set-a', 'set-b', 'set-c'])
  expect(useWikiStore.getState().hasStoredExpansion).toBe(true)

  useWikiStore.getState().setExpandedEquipmentGroups([])
  expect(useWikiStore.getState().expandedEquipmentGroups).toEqual([])
  // Collapse-all is an explicit choice — it must survive a reload, not be re-defaulted.
  expect(useWikiStore.getState().hasStoredExpansion).toBe(true)
})

it('copies the incoming keys instead of aliasing the caller array', () => {
  const keys = ['set-a']
  useWikiStore.getState().setExpandedEquipmentGroups(keys)
  keys.push('set-b')

  expect(useWikiStore.getState().expandedEquipmentGroups).toEqual(['set-a'])
})

it('resets back to first-visit behaviour', () => {
  useWikiStore.getState().setExpandedEquipmentGroups(['set-a'])
  useWikiStore.getState().resetEquipmentGroups()

  expect(useWikiStore.getState().expandedEquipmentGroups).toEqual([])
  expect(useWikiStore.getState().hasStoredExpansion).toBe(false)
})
