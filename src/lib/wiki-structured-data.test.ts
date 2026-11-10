import { describe, expect, it } from 'vitest'
import { DEFAULT_SITE_URL } from '@/lib/constants'
import {
  ITEM_LIST_LIMIT,
  buildCollectionPageLd,
  buildDetailPageLd,
  pageUrl,
  wikiListBreadcrumbs,
} from './wiki-structured-data'

const SITE = 'CEP 终末地规划器'

interface LdGraph {
  '@context': string
  '@graph': Array<Record<string, unknown>>
}

describe('pageUrl', () => {
  it('把 locale 与路径拼成绝对地址', () => {
    expect(pageUrl('zh-CN')).toBe(`${DEFAULT_SITE_URL}/zh-CN`)
    expect(pageUrl('en', 'wiki/characters')).toBe(`${DEFAULT_SITE_URL}/en/wiki/characters`)
  })
})

describe('buildCollectionPageLd', () => {
  const ld = buildCollectionPageLd({
    locale: 'zh-CN',
    siteName: SITE,
    name: '干员图鉴',
    description: '全部干员',
    path: 'wiki/characters',
    items: [
      { name: '陈', url: `${DEFAULT_SITE_URL}/zh-CN/wiki/characters/chr_0025_ardelia` },
      { name: '凯尔希', url: `${DEFAULT_SITE_URL}/zh-CN/wiki/characters/chr_0030_zhuangfy` },
    ],
    breadcrumbs: wikiListBreadcrumbs('zh-CN', '首页', '干员图鉴', 'wiki/characters'),
  }) as unknown as LdGraph

  it('输出 CollectionPage + BreadcrumbList 两个节点', () => {
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@graph'].map((node) => node['@type'])).toEqual(['CollectionPage', 'BreadcrumbList'])
  })

  it('主实体是 ItemList，position 从 1 连续递增', () => {
    const page = ld['@graph'][0]
    const list = page.mainEntity as { '@type': string; numberOfItems: number; itemListElement: Array<{ position: number; url: string }> }
    expect(list['@type']).toBe('ItemList')
    expect(list.numberOfItems).toBe(2)
    expect(list.itemListElement.map((item) => item.position)).toEqual([1, 2])
    expect(list.itemListElement[0].url.startsWith(DEFAULT_SITE_URL)).toBe(true)
  })

  it('ItemList 截断到 ITEM_LIST_LIMIT，numberOfItems 报截断后的数量', () => {
    const many = Array.from({ length: ITEM_LIST_LIMIT + 5 }, (_, index) => ({
      name: `条目 ${index}`,
      url: `${DEFAULT_SITE_URL}/zh-CN/wiki/characters/c${index}`,
    }))
    const big = buildCollectionPageLd({
      locale: 'zh-CN',
      siteName: SITE,
      name: '干员图鉴',
      description: '全部干员',
      path: 'wiki/characters',
      items: many,
      breadcrumbs: wikiListBreadcrumbs('zh-CN', '首页', '干员图鉴', 'wiki/characters'),
    }) as unknown as { '@graph': Array<{ mainEntity: { numberOfItems: number; itemListElement: unknown[] } }> }
    expect(big['@graph'][0].mainEntity.itemListElement).toHaveLength(ITEM_LIST_LIMIT)
    expect(big['@graph'][0].mainEntity.numberOfItems).toBe(ITEM_LIST_LIMIT)
  })

  it('面包屑的 position 从 1 开始且末项是当前页', () => {
    const crumbs = ld['@graph'][1].itemListElement as Array<{ position: number; name: string; item: string }>
    expect(crumbs.map((entry) => entry.position)).toEqual([1, 2])
    expect(crumbs[1].item).toBe(`${DEFAULT_SITE_URL}/zh-CN/wiki/characters`)
  })
})

describe('buildDetailPageLd', () => {
  const ld = buildDetailPageLd({
    locale: 'en',
    siteName: SITE,
    name: 'Ardelia',
    description: 'character data',
    url: `${DEFAULT_SITE_URL}/en/wiki/characters/chr_0025_ardelia`,
    image: `${DEFAULT_SITE_URL}/images/characters/chr_0025_ardelia.avif`,
    breadcrumbs: [
      { name: 'Home', url: `${DEFAULT_SITE_URL}/en` },
      { name: 'Characters', url: `${DEFAULT_SITE_URL}/en/wiki/characters` },
      { name: 'Ardelia', url: `${DEFAULT_SITE_URL}/en/wiki/characters/chr_0025_ardelia` },
    ],
  }) as unknown as LdGraph

  it('输出 WebPage + BreadcrumbList，并带上 about / 主图', () => {
    expect(ld['@graph'].map((node) => node['@type'])).toEqual(['WebPage', 'BreadcrumbList'])
    const page = ld['@graph'][0]
    expect(page.about).toEqual({ '@type': 'Thing', name: 'Ardelia' })
    expect(page.primaryImageOfPage).toEqual({
      '@type': 'ImageObject',
      url: `${DEFAULT_SITE_URL}/images/characters/chr_0025_ardelia.avif`,
    })
    expect((ld['@graph'][1].itemListElement as unknown[]).length).toBe(3)
  })

  it('没有配图时不输出 primaryImageOfPage', () => {
    const noImage = buildDetailPageLd({
      locale: 'en',
      siteName: SITE,
      name: 'Ardelia',
      description: 'character data',
      url: `${DEFAULT_SITE_URL}/en/wiki/characters/chr_0025_ardelia`,
      breadcrumbs: [{ name: 'Home', url: `${DEFAULT_SITE_URL}/en` }],
    }) as unknown as LdGraph
    expect(noImage['@graph'][0]).not.toHaveProperty('primaryImageOfPage')
  })
})
