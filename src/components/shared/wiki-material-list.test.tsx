// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, expect, it } from 'vitest'
import { formatMaterialCount, WikiMaterialList } from './wiki-material-list'

const localized = (value: string) => ({ 'zh-CN': value, en: value, ja: value, 'zh-TW': value })

afterEach(cleanup)
it('formats material counts in thousands without changing smaller values', () => {
  expect(formatMaterialCount(999)).toBe('999')
  expect(formatMaterialCount(1000)).toBe('1k')
  expect(formatMaterialCount(1250)).toBe('1.3k')
  expect(formatMaterialCount(8000)).toBe('8k')
})

it('keeps material text outside rarity-framed icons', () => {
  render(
    <NextIntlClientProvider locale="zh-CN" messages={{ wikiData: { 'item|material-a': '测试材料' }, characters: {}, weapons: {}, equips: {} }}>
      <WikiMaterialList materials={[
        { itemId: 'material-a', name: localized('测试材料'), iconId: 'material-a', rarity: 4, count: 12 },
      ]} />
    </NextIntlClientProvider>
  )

  expect(screen.getByText('测试材料')).toBeTruthy()
  expect(screen.getByText('×12')).toBeTruthy()
  expect(screen.getByTestId('rarity-frame-band').getAttribute('src')).toBe('/images/item-band-4.png')
  expect(screen.queryByRole('heading', { name: '测试材料' })).toBeNull()
})

it('supports compact icon and count only rendering', () => {
  render(
    <NextIntlClientProvider locale="zh-CN" messages={{ wikiData: { 'item|material-a': '测试材料' }, characters: {}, weapons: {}, equips: {} }}>
      <WikiMaterialList iconOnly compact materials={[
        { itemId: 'material-a', name: localized('测试材料'), iconId: 'material-a', rarity: 4, count: 12 },
      ]} />
    </NextIntlClientProvider>
  )

  expect(screen.queryByText('测试材料')).toBeNull()
  expect(screen.getByText('×12')).toBeTruthy()
  expect(screen.getByTitle('测试材料')).toBeTruthy()
})
