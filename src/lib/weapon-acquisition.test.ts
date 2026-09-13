import { describe, expect, it, vi } from 'vitest'
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

describe('acquisitionCategoryLabelText', () => {
  const mockWikiText = vi.fn((_ns: string, key: string) => {
    if (key === 'gacha') return '武器抽取'
    return key
  })

  const mockTranslator = Object.assign(
    (key: string) => {
      if (key === 'essenceSettings.acquisitionCategory.unknown') return '未知'
      if (key === 'essenceSettings.acquisitionCategory.shop') return '商店兑换'
      return key
    },
    {
      has: (key: string) =>
        key === 'essenceSettings.acquisitionCategory.unknown' ||
        key === 'essenceSettings.acquisitionCategory.shop',
    }
  )

  it('returns static translation directly when present in messages without calling wikiText', async () => {
    mockWikiText.mockClear()
    const { acquisitionCategoryLabelText } = await import('./weapon-acquisition')
    expect(acquisitionCategoryLabelText('unknown', mockWikiText, mockTranslator)).toBe('未知')
    expect(acquisitionCategoryLabelText('shop', mockWikiText, mockTranslator)).toBe('商店兑换')
    expect(mockWikiText).not.toHaveBeenCalled()
  })

  it('falls back to wikiText when static translation is not found', async () => {
    mockWikiText.mockClear()
    const { acquisitionCategoryLabelText } = await import('./weapon-acquisition')
    expect(acquisitionCategoryLabelText('gacha', mockWikiText, mockTranslator)).toBe('武器抽取')
    expect(mockWikiText).toHaveBeenCalledWith('acquisitionCategory', 'gacha')
  })

  it('falls back to categoryId if both static translation and wikiText fail', async () => {
    mockWikiText.mockClear()
    const { acquisitionCategoryLabelText } = await import('./weapon-acquisition')
    expect(acquisitionCategoryLabelText('nonexistent', mockWikiText, mockTranslator)).toBe('nonexistent')
    expect(mockWikiText).toHaveBeenCalledWith('acquisitionCategory', 'nonexistent')
  })
})
