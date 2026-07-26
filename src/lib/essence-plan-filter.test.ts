import { describe, expect, it } from 'vitest'
import { formatNameList, isDungeonInRegionFilter, type RegionFilterSelection } from './essence-plan-filter'

const SUB_REGIONS: ReadonlyMap<string, readonly string[]> = new Map([
  ['四号谷地', ['枢纽区', '源石研究园', '供能高地', '矿脉源区']],
  ['武陵', ['武陵城', '清波寨', '首墩']],
])

function selection(regions: string[], subRegions: string[]): RegionFilterSelection {
  return {
    selectedRegions: new Set(regions),
    selectedSubRegions: new Set(subRegions),
    subRegionsByRegion: SUB_REGIONS,
  }
}

describe('isDungeonInRegionFilter', () => {
  it('passes everything when nothing is selected', () => {
    expect(isDungeonInRegionFilter('武陵', '清波寨', selection([], []))).toBe(true)
  })

  it('rejects dungeons outside the selected regions', () => {
    expect(isDungeonInRegionFilter('武陵', '清波寨', selection(['四号谷地'], []))).toBe(false)
    expect(isDungeonInRegionFilter('四号谷地', '枢纽区', selection(['四号谷地'], []))).toBe(true)
  })

  it('scopes sub-region selections to their own region', () => {
    // One sub-region picked inside 四号谷地 while both regions are selected.
    const filter = selection(['四号谷地', '武陵'], ['枢纽区'])

    expect(isDungeonInRegionFilter('四号谷地', '枢纽区', filter)).toBe(true)
    expect(isDungeonInRegionFilter('四号谷地', '供能高地', filter)).toBe(false)
    // Regression: 武陵 has no sub-region picked → all of it stays visible.
    expect(isDungeonInRegionFilter('武陵', '清波寨', filter)).toBe(true)
    expect(isDungeonInRegionFilter('武陵', '首墩', filter)).toBe(true)
  })

  it('applies independent sub-region selections per region', () => {
    const filter = selection(['四号谷地', '武陵'], ['枢纽区', '首墩'])

    expect(isDungeonInRegionFilter('四号谷地', '枢纽区', filter)).toBe(true)
    expect(isDungeonInRegionFilter('四号谷地', '矿脉源区', filter)).toBe(false)
    expect(isDungeonInRegionFilter('武陵', '首墩', filter)).toBe(true)
    expect(isDungeonInRegionFilter('武陵', '清波寨', filter)).toBe(false)
  })

  it('ignores sub-region selections for regions with no known sub-regions', () => {
    const filter = selection(['未知地区'], ['枢纽区'])
    expect(isDungeonInRegionFilter('未知地区', '未知地区', filter)).toBe(true)
  })

  it('still scopes sub-regions when no region chip is active', () => {
    // Possible with persisted state: subs without their parent region.
    const filter = selection([], ['枢纽区'])
    expect(isDungeonInRegionFilter('四号谷地', '枢纽区', filter)).toBe(true)
    expect(isDungeonInRegionFilter('四号谷地', '供能高地', filter)).toBe(false)
    expect(isDungeonInRegionFilter('武陵', '清波寨', filter)).toBe(true)
  })
})

describe('formatNameList', () => {
  it('returns an empty string for no names', () => {
    expect(formatNameList([], 'zh-CN')).toBe('')
  })

  it('returns a single name unchanged', () => {
    expect(formatNameList(['破晓'], 'en')).toBe('破晓')
  })

  it('uses locale conventions instead of a hardcoded separator', () => {
    expect(formatNameList(['A', 'B', 'C'], 'zh-CN')).toBe('A、B和C')
    expect(formatNameList(['A', 'B', 'C'], 'en')).toBe('A, B, and C')
    expect(formatNameList(['A', 'B', 'C'], 'ja')).toBe('A、B、C')
  })

  it('falls back to a comma join for an unusable locale tag', () => {
    expect(formatNameList(['A', 'B'], 'not a locale')).toBe('A, B')
  })
})
