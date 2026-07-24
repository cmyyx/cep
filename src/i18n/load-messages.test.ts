import { expect, it } from 'vitest'
import { loadClientMessages, loadMessages } from './load-messages'

it('client messages omit wikiData for every locale', () => {
  for (const locale of ['zh-CN', 'zh-TW', 'ja', 'en'] as const) {
    const messages = loadClientMessages(locale) as Record<string, unknown>
    expect(messages).not.toHaveProperty('wikiData')
    expect(messages).toHaveProperty('nav')
    expect(messages).toHaveProperty('weapons')
  }
})

it('server messages include wikiData for the selected locale', () => {
  const en = loadMessages('en') as Record<string, unknown>
  expect(en).toHaveProperty('wikiData')
  expect(en.wikiData).toBeTruthy()
  expect(typeof en.wikiData).toBe('object')
  expect(Object.keys(en.wikiData as object).length).toBeGreaterThan(100)

  const zh = loadMessages('zh-CN') as Record<string, unknown>
  expect(zh).toHaveProperty('wikiData')
  // Different locale catalogs are distinct objects (not accidentally sharing client-only bags).
  expect(zh.wikiData).not.toBe(en.wikiData)
})
