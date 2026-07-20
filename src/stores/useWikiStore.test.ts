import { beforeEach, expect, it } from 'vitest'
import { useWikiStore } from './useWikiStore'

beforeEach(() => {
  useWikiStore.setState({ expandedEquipmentGroups: [] })
})

it('toggles equipment group expansion without affecting other groups', () => {
  const store = useWikiStore.getState()

  store.toggleEquipmentGroup('independent')
  store.toggleEquipmentGroup('set-a')
  expect(useWikiStore.getState().expandedEquipmentGroups).toEqual(['independent', 'set-a'])

  useWikiStore.getState().toggleEquipmentGroup('independent')
  expect(useWikiStore.getState().expandedEquipmentGroups).toEqual(['set-a'])
})
