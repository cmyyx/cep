import { expect, it } from 'vitest'
import { buildWikiEnumCatalog, wikiEnumIds } from './wiki-enum-catalog'

it('exposes the generated enum id order', () => {
  expect(wikiEnumIds('equipmentParts')).toEqual(['0', '1', '2'])
  expect(wikiEnumIds('weaponTypes').length).toBeGreaterThan(0)
})

it('builds server-resolved labels for every id of the requested groups', () => {
  const { labels, order } = buildWikiEnumCatalog(
    ['equipmentParts', 'weaponTypes'],
    (group, id) => `${group}#${id}`,
  )

  expect(order.equipmentParts).toEqual(['0', '1', '2'])
  expect(labels.equipmentParts).toEqual({
    '0': 'equipmentParts#0',
    '1': 'equipmentParts#1',
    '2': 'equipmentParts#2',
  })
  expect(Object.keys(labels.weaponTypes ?? {})).toEqual([...wikiEnumIds('weaponTypes')])
  expect(labels.elements).toBeUndefined()
  expect(order.elements).toBeUndefined()
})
