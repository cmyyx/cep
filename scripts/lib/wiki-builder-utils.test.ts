import { describe, expect, it } from 'vitest'
import { cleanWikiText, evaluateWikiExpression, resolveWikiDescription } from './wiki-builder-utils'

describe('Wiki expression evaluation', () => {
  const values = {
    duration: 1.75,
    costValue: 0.85,
    spell_dmg_up2: 0.1,
    max_stack: 3,
    coolDown: 2,
  }

  it.each([
    ['duration-1', 0.75],
    ['1-costvalue', 0.15],
    ['spell_dmg_up2*max_stack', 0.3],
    ['-coolDown', -2],
    ['(duration-1)/3', 0.25],
  ])('evaluates %s without executing code', (expression, expected) => {
    expect(evaluateWikiExpression(expression, values)).toBeCloseTo(expected)
  })

  it('looks up variables case-insensitively', () => {
    expect(evaluateWikiExpression('COSTVALUE', values)).toBe(0.85)
  })

  it('rejects unsupported syntax and unknown variables', () => {
    expect(evaluateWikiExpression('globalThis.process.exit()', values)).toBeUndefined()
    expect(evaluateWikiExpression('missing+1', values)).toBeUndefined()
  })

  it('resolves compound placeholders with formatting', () => {
    expect(resolveWikiDescription(
      'Duration +{duration-1:0%}; cost -{1-costvalue:0%}; total {spell_dmg_up2*max_stack:0%}',
      values
    )).toBe('Duration +75%; cost -15%; total 30%')
  })
})

describe('Wiki rich text preservation', () => {
  it('keeps supported game markup and removes arbitrary HTML', () => {
    expect(cleanWikiText(
      '<@ba.vup>+{atk:0%}</> <#ba.consume>consume</> <image="TermIcon/test" scale=1.25> <script>alert(1)</script>'
    )).toBe('<@ba.vup>+{atk:0%}</> <#ba.consume>consume</> <image="TermIcon/test" scale=1.25> alert(1)')
  })
})
