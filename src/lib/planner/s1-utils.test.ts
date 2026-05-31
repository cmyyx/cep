import { describe, it, expect } from 'vitest'
import { computeEffectiveS1 } from './s1-utils'

const ALL_S1 = ['力量提升', '敏捷提升', '智识提升', '意志提升', '主能力提升'] as const

describe('computeEffectiveS1', () => {
  // ── <= 3 visible candidates → use all visible, ignore stored/solver ──

  it('returns all visible when <= 3 candidates (no choice needed)', () => {
    const visible = ['力量提升', '敏捷提升']
    expect(computeEffectiveS1(undefined, ['力量提升'], visible)).toEqual(visible)
  })

  it('returns all visible even when stored override exists', () => {
    const visible = ['力量提升', '敏捷提升', '智识提升']
    const stored = ['力量提升']
    expect(computeEffectiveS1(stored, ['力量提升'], visible)).toEqual(visible)
  })

  it('returns empty when no visible candidates', () => {
    expect(computeEffectiveS1(undefined, ['力量提升'], [])).toEqual([])
  })

  // ── > 3 visible candidates, no stored override ──

  it('uses solver selection filtered to visible when no stored override', () => {
    const visible = [...ALL_S1]
    const solverS1 = ['力量提升', '敏捷提升', '智识提升']
    expect(computeEffectiveS1(undefined, solverS1, visible)).toEqual(solverS1)
  })

  it('filters solver selection to only visible stats', () => {
    const visible = ['力量提升', '敏捷提升', '智识提升', '意志提升']
    // solver selected 主能力提升 which is not visible
    const solverS1 = ['力量提升', '敏捷提升', '主能力提升']
    const result = computeEffectiveS1(undefined, solverS1, visible)
    expect(result).toEqual(['力量提升', '敏捷提升'])
  })

  it('falls back to visible when solver selection has no visible overlap', () => {
    const visible = ['力量提升', '敏捷提升', '智识提升', '意志提升']
    const solverS1 = ['主能力提升'] // not in visible
    expect(computeEffectiveS1(undefined, solverS1, visible)).toEqual(visible)
  })

  // ── > 3 visible candidates, stored override exists ──

  it('filters stored override to visible candidates', () => {
    const visible = [...ALL_S1]
    const stored = ['力量提升', '智识提升', '意志提升']
    expect(computeEffectiveS1(stored, ['力量提升'], visible)).toEqual(stored)
  })

  it('excludes stored stats that are no longer visible', () => {
    const visible = ['力量提升', '敏捷提升', '智识提升', '意志提升']
    const stored = ['力量提升', '敏捷提升', '主能力提升'] // 主能力提升 hidden
    const result = computeEffectiveS1(stored, ['力量提升'], visible)
    expect(result).toEqual(['力量提升', '敏捷提升'])
  })

  it('falls back to solver selection when stored has no visible overlap', () => {
    const visible = ['力量提升', '敏捷提升', '智识提升', '意志提升']
    const stored = ['主能力提升'] // not in visible
    const solverS1 = ['力量提升', '敏捷提升', '智识提升']
    expect(computeEffectiveS1(stored, solverS1, visible)).toEqual(solverS1)
  })

  it('falls back to all visible when both stored and solver have no overlap', () => {
    const visible = ['力量提升', '敏捷提升', '智识提升', '意志提升']
    const stored = ['主能力提升']
    const solverS1 = ['主能力提升']
    expect(computeEffectiveS1(stored, solverS1, visible)).toEqual(visible)
  })

  // ── Real-world scenario: hiding reduces candidates from >3 to <=3 ──

  it('auto-selects all visible when hiding reduces 5 candidates to 3', () => {
    const visible = ['力量提升', '敏捷提升', '智识提升']
    const stored = ['力量提升', '智识提升', '意志提升'] // 意志提升 was valid before
    // With <= 3 visible, stored is ignored and all visible are returned
    expect(computeEffectiveS1(stored, ['力量提升'], visible)).toEqual(visible)
  })

  it('auto-selects all visible when hiding reduces 4 candidates to 2', () => {
    const visible = ['力量提升', '敏捷提升']
    const stored = ['力量提升', '智识提升', '意志提升']
    expect(computeEffectiveS1(stored, ['力量提升'], visible)).toEqual(visible)
  })
})
