import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ROUTE_META,
  SITE_URL,
  assertRouteMetaCoverage,
  buildLlmsFullTxt,
  buildLlmsTxt,
  entityLabel,
  formatLink,
  pageUrl,
  parseDefaultSiteUrl,
  parseSitemapRoutePaths,
  parseWikiSummaryArray,
} from './generate-llms-txt.mjs'

const SAMPLE_SITEMAP = `
export const ROUTES: {
  path: string
  priority: number
}[] = [
  { path: '',                 priority: 0.7 },
  { path: 'essence-planner',  priority: 1 },
  { path: 'account',          priority: 0.3 },
]
`

const SAMPLE_WIKI = `
// Auto-generated
import type { WikiCharacterSummary } from '@/types/wiki'

export const wikiCharacters = [
  {
    "id": "chr_0004_pelica",
    "category": "characters",
    "name": {
      "zh-CN": "佩丽卡",
      "en": "Perlica",
      "ja": "ペリカ",
      "zh-TW": "佩麗卡"
    },
    "rarity": 5
  },
  {
    "id": "chr_0005_chen",
    "category": "characters",
    "name": {
      "zh-CN": "陈千语",
      "en": "Chen Qianyu"
    },
    "rarity": 5
  }
] satisfies WikiCharacterSummary[]
`

describe('parseSitemapRoutePaths', () => {
  it('extracts every path including empty home', () => {
    expect(parseSitemapRoutePaths(SAMPLE_SITEMAP)).toEqual([
      '',
      'essence-planner',
      'account',
    ])
  })

  it('throws when ROUTES is missing', () => {
    expect(() => parseSitemapRoutePaths('export const x = 1')).toThrow(/ROUTES/)
  })
})

describe('assertRouteMetaCoverage', () => {
  it('passes when meta and sitemap match', () => {
    expect(() =>
      assertRouteMetaCoverage(['a', 'b'], {
        a: { section: 'core' },
        b: { section: 'optional' },
      }),
    ).not.toThrow()
  })

  it('fails on missing and orphan meta', () => {
    expect(() =>
      assertRouteMetaCoverage(['a'], {
        b: { section: 'core' },
      }),
    ).toThrow(/Missing ROUTE_META/)
  })
})

describe('parseWikiSummaryArray', () => {
  it('parses generated wiki TS modules', () => {
    const items = parseWikiSummaryArray(SAMPLE_WIKI)
    expect(items).toHaveLength(2)
    expect(items[0].id).toBe('chr_0004_pelica')
    expect(items[0].name.en).toBe('Perlica')
  })
})

describe('parseDefaultSiteUrl', () => {
  it('reads DEFAULT_SITE_URL from constants source', () => {
    expect(
      parseDefaultSiteUrl(
        "export const DEFAULT_SITE_URL = 'https://example.test'\n",
      ),
    ).toBe('https://example.test')
  })

  it('throws when constant is missing', () => {
    expect(() => parseDefaultSiteUrl('export const X = 1')).toThrow(
      /DEFAULT_SITE_URL/,
    )
  })

  it('matches the live constants module used by the generator', () => {
    expect(SITE_URL).toBe('https://end.canmoe.com')
  })
})

describe('helpers', () => {
  it('builds locale URLs', () => {
    expect(pageUrl('')).toBe(`${SITE_URL}/zh-CN`)
    expect(pageUrl('essence-planner')).toBe(
      'https://end.canmoe.com/zh-CN/essence-planner',
    )
    expect(pageUrl('wiki/weapons/wpn_1', 'en')).toBe(
      'https://end.canmoe.com/en/wiki/weapons/wpn_1',
    )
  })

  it('formats entity labels with rarity', () => {
    expect(
      entityLabel({
        id: 'x',
        name: { en: 'Perlica', 'zh-CN': '佩丽卡' },
        rarity: 5,
      }),
    ).toBe('Perlica (5★)')
  })

  it('formats markdown links', () => {
    expect(formatLink('A', 'https://x', 'note')).toBe('- [A](https://x): note')
    expect(formatLink('A', 'https://x')).toBe('- [A](https://x)')
  })
})

describe('buildLlmsTxt', () => {
  const sitemapPaths = Object.keys(ROUTE_META)

  it('emits required H1, summary, core tools, and wiki indexes only', () => {
    const txt = buildLlmsTxt({
      sitemapPaths,
      generatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(txt.startsWith('# CEP Endfield Planner\n')).toBe(true)
    expect(txt).toContain(
      '> Free planner suite for Arknights: Endfield',
    )
    expect(txt).toContain('## Core tools')
    expect(txt).toContain(
      '- [Essence Planner](https://end.canmoe.com/zh-CN/essence-planner):',
    )
    expect(txt).toContain('## Wiki')
    expect(txt).toContain(
      '- [Characters Wiki](https://end.canmoe.com/zh-CN/wiki/characters):',
    )
    // detail entities belong in llms-full.txt only
    expect(txt).not.toContain('## Characters')
    expect(txt).not.toContain('## Weapons')
    expect(txt).not.toContain('## Equipment')
    expect(txt).not.toContain('/wiki/characters/chr_0004_pelica')
    expect(txt).toContain('llms-full.txt')
    expect(txt).toContain('## Optional')
    expect(txt).toContain('https://end.canmoe.com/sitemap.xml')
    expect(txt).toContain('Generated at: 2026-01-01T00:00:00.000Z')
    // auth chrome must stay out
    expect(txt).not.toContain('/account')
    expect(txt).not.toContain('/login')
    expect(txt).not.toContain('/settings')
  })

  it('stays in sync with the real sitemap ROUTES', () => {
    const sitemapPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../src/app/sitemap.ts',
    )
    const paths = parseSitemapRoutePaths(readFileSync(sitemapPath, 'utf8'))
    expect(() => assertRouteMetaCoverage(paths)).not.toThrow()
    expect(paths).toEqual(expect.arrayContaining(Object.keys(ROUTE_META)))
    expect(Object.keys(ROUTE_META)).toEqual(expect.arrayContaining(paths))
  })
})

describe('buildLlmsFullTxt', () => {
  it('expands character details and empty weapons/equipment sections in order', () => {
    const txt = buildLlmsFullTxt({
      characters: [
        {
          id: 'chr_0004_pelica',
          name: { en: 'Perlica', 'zh-CN': '佩丽卡' },
          rarity: 5,
        },
      ],
      weapons: [],
      equipment: [],
      sitemapPaths: Object.keys(ROUTE_META),
      generatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(txt.startsWith('# CEP Endfield Planner — Full Context\n')).toBe(true)
    expect(txt).toContain('## About the site')
    expect(txt).not.toContain('Deployment model')
    expect(txt).toContain('## Core tools')
    expect(txt).toContain('## Wiki indexes')
    expect(txt).toContain('## Characters (1)')
    expect(txt).toContain(
      'Perlica (5★) — https://end.canmoe.com/zh-CN/wiki/characters/chr_0004_pelica',
    )
    expect(txt).toContain('## Weapons (0)')
    expect(txt).toContain('## Equipment (0)')
    expect(txt).toContain('## Optional pages')
    expect(txt).toContain('Generated at: 2026-01-01T00:00:00.000Z')
    expect(txt).toContain('https://end.canmoe.com/llms.txt')

    const sectionOrder = [
      '## About the site',
      '## Core tools',
      '## Wiki indexes',
      '## Characters (1)',
      '## Weapons (0)',
      '## Equipment (0)',
      '## Optional pages',
    ]
    const indexes = sectionOrder.map((heading) => txt.indexOf(heading))
    expect(indexes.every((index) => index >= 0)).toBe(true)
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes)
  })
})
