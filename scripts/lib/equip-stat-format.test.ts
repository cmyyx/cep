import { describe, it, expect } from 'vitest'
import {
  formatEquipStat,
  parseValueFormat,
  resolveFormat,
  type AttrShowConfig,
} from './equip-stat-format'

describe('parseValueFormat', () => {
  it('parses {formula:spec}', () => {
    expect(parseValueFormat('{value:0.0%}')).toEqual({ formula: 'value', spec: '0.0%' })
    expect(parseValueFormat('{1-value:0.0%}')).toEqual({ formula: '1-value', spec: '0.0%' })
    expect(parseValueFormat('{100-100*value:0}')).toEqual({ formula: '100-100*value', spec: '0' })
  })

  it('parses {formula} without spec', () => {
    expect(parseValueFormat('{value}')).toEqual({ formula: 'value', spec: '' })
  })

  it('returns null for empty string', () => {
    expect(parseValueFormat('')).toBeNull()
  })

  it('throws on malformed format', () => {
    expect(() => parseValueFormat('value:0.0%')).toThrow()
    expect(() => parseValueFormat('{value:0.0%')).toThrow()
    expect(() => parseValueFormat('value')).toThrow()
  })
})

describe('formatEquipStat', () => {
  describe('empty valueFormat (raw value)', () => {
    it('integer value, no %', () => {
      expect(formatEquipStat('39', '32', '')).toBe('39+32')
    })
    it('decimal value, no %', () => {
      expect(formatEquipStat('Sub', '10.3508917532', '')).toBe('Sub+10.3508917532')
    })
  })

  describe('{value} (raw value)', () => {
    it('integer', () => {
      expect(formatEquipStat('39', '32', '{value}')).toBe('39+32')
    })
  })

  describe('{value:0.0%} (percent)', () => {
    it('multiplies by 100 and appends %', () => {
      expect(formatEquipStat('28', '0.25875', '{value:0.0%}')).toBe('28+25.875%')
    })
    it('cleans FP noise at 8th decimal (toFixed(8) + parseFloat)', () => {
      // 0.103508917532 * 100 = 10.3508917532; toFixed(8) → "10.35089175"
      expect(formatEquipStat('Sub', '0.103508917532', '{value:0.0%}')).toBe('Sub+10.35089175%')
    })
  })

  describe('{1-value:0.0%} (reduction)', () => {
    it('纾难识别牌: (1 - 0.8223684210526316) * 100 = 17.76315789', () => {
      expect(formatEquipStat('AllDamageTakenScalar', '0.8223684210526316', '{1-value:0.0%}'))
        .toBe('AllDamageTakenScalar+17.76315789%')
    })
    it('生物辅助接驳器: (1 - 0.828500414250207) * 100 = 17.14995857', () => {
      expect(formatEquipStat('AllDamageTakenScalar', '0.828500414250207', '{1-value:0.0%}'))
        .toBe('AllDamageTakenScalar+17.14995857%')
    })
  })

  describe('{value-1:0.0%} (gain over baseline)', () => {
    it('(1.2 - 1) * 100 = 20', () => {
      expect(formatEquipStat('X', '1.2', '{value-1:0.0%}')).toBe('X+20%')
    })
  })

  describe('{100-100*value:0} (no % suffix)', () => {
    it('100 - 100*0.3 = 70, no %', () => {
      expect(formatEquipStat('Y', '0.3', '{100-100*value:0}')).toBe('Y+70')
    })
  })

  describe('{100*value:0} (no % suffix, multiplication)', () => {
    it('100 * 0.3 = 30, no %', () => {
      expect(formatEquipStat('Y', '0.3', '{100*value:0}')).toBe('Y+30')
    })
  })

  describe('arbitrary future formulas (auto-recognized)', () => {
    it('{value*2:0.0%} doubles value then ×100 + %', () => {
      // 0.1 * 2 * 100 = 20
      expect(formatEquipStat('Z', '0.1', '{value*2:0.0%}')).toBe('Z+20%')
    })
    it('{(1-value)*100:0} with parens', () => {
      // (1-0.25)*100 = 75, no %
      expect(formatEquipStat('Z', '0.25', '{(1-value)*100:0}')).toBe('Z+75')
    })
    it('{50+value*2:0} with precedence', () => {
      // 50 + 5*2 = 60
      expect(formatEquipStat('Z', '5', '{50+value*2:0}')).toBe('Z+60')
    })
    it('unary minus {-value:0}', () => {
      expect(formatEquipStat('Z', '5', '{-value:0}')).toBe('Z+-5')
    })
  })

  it('throws on unrecognized formula token', () => {
    expect(() => formatEquipStat('Z', '1', '{value&2:0}')).toThrow()
  })

  it('throws on unbalanced parens', () => {
    expect(() => formatEquipStat('Z', '1', '{(value:0}')).toThrow()
  })

  it('throws on malformed numeric literal (e.g. 1..2)', () => {
    expect(() => formatEquipStat('Z', '1', '{1..2-value:0}')).toThrow(/畸形数字字面量/)
  })

  it('throws on non-numeric attrValue (empty string)', () => {
    expect(() => formatEquipStat('Z', '', '{value:0.0%}')).toThrow(/不是合法数值/)
  })

  it('throws on non-numeric attrValue (text)', () => {
    expect(() => formatEquipStat('Z', 'abc', '{value:0.0%}')).toThrow(/不是合法数值/)
  })

  it('throws on non-numeric attrValue with empty valueFormat', () => {
    expect(() => formatEquipStat('Z', '', '')).toThrow(/不是合法数值/)
  })
})

describe('resolveFormat', () => {
  const cfg: AttrShowConfig = {
    name: '全伤害减免',
    entries: [
      { attributeModifier: 9, showPercent: true, valueFormat: '{1-value:0.0%}' },
      { attributeModifier: 8, showPercent: true, valueFormat: '{1-value:0.0%}' },
    ],
  }

  it('returns valueFormat for matching modifierType', () => {
    expect(resolveFormat(cfg, 'AllDamageTakenScalar', 9)).toBe('{1-value:0.0%}')
    expect(resolveFormat(cfg, 'AllDamageTakenScalar', 8)).toBe('{1-value:0.0%}')
  })

  it('throws when modifierType not in list', () => {
    expect(() => resolveFormat(cfg, 'AllDamageTakenScalar', 5)).toThrow(
      /modifierType=5 未在配置 list 中找到匹配条目/,
    )
  })

  it('throws when cfg is undefined', () => {
    expect(() => resolveFormat(undefined, 'Missing', 5)).toThrow(/无任何条目/)
  })

  it('throws when cfg has empty entries', () => {
    expect(() => resolveFormat({ name: 'X', entries: [] }, 'X', 5)).toThrow(/无任何条目/)
  })

  it('error message lists available modifiers', () => {
    expect(() => resolveFormat(cfg, 'K', 5)).toThrow(/\[9, 8\]/)
  })
})
