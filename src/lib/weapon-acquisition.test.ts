import { describe, expect, it } from 'vitest'
import type { WeaponAcquisitionSource } from '@/types/weapon-acquisition'
import { acquisitionCategoryIds, isHiddenByAcquisitionCategory } from './weapon-acquisition'

const source = (categoryId: string): WeaponAcquisitionSource => ({ categoryId, sourceId: `${categoryId}_x` })

describe('acquisitionCategoryIds', () => {
  it('returns distinct category ids in display order', () => {
    const sources = [source('shop'), source('gacha'), source('chest'), source('gacha')]
    expect(acquisitionCategoryIds(sources)).toEqual(['gacha', 'shop', 'chest'])
  })

  it('puts unknown categories after known ones, keeping their data order', () => {
    const sources = [source('future'), source('chest'), source('another')]
    expect(acquisitionCategoryIds(sources)).toEqual(['chest', 'future', 'another'])
  })

  it('returns an empty list for missing or empty sources', () => {
    expect(acquisitionCategoryIds(undefined)).toEqual([])
    expect(acquisitionCategoryIds([])).toEqual([])
  })
})

describe('isHiddenByAcquisitionCategory', () => {
  it('hides a weapon whose category matches a hidden id', () => {
    const sources = [source('gacha')]
    expect(isHiddenByAcquisitionCategory(sources, ['gacha'])).toBe(true)
  })

  it('never hides weapons without acquisition data (custom/preview weapons)', () => {
    expect(isHiddenByAcquisitionCategory(undefined, ['gacha', 'unknown'])).toBe(false)
    expect(isHiddenByAcquisitionCategory([], ['unknown'])).toBe(false)
  })

  it('is a no-op when nothing is hidden', () => {
    expect(isHiddenByAcquisitionCategory([source('gacha')], [])).toBe(false)
  })

  it('keeps a weapon visible when at least one category survives the filter', () => {
    const sources = [source('gacha'), source('shop')]
    expect(isHiddenByAcquisitionCategory(sources, ['shop'])).toBe(true)
    expect(isHiddenByAcquisitionCategory(sources, ['chest'])).toBe(false)
  })
})
