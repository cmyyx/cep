/**
 * Shared equip-stat formatting — single source of truth.
 *
 * 上游 `AttributeShowConfigTable.json` / `CompositeAttributeShowConfigTable.json`
 * 中每个属性条目都带 `valueFormat` 字段（形如 `{formula:spec}`），定义了值的计算公式
 * 和显示格式。本模块解析 valueFormat，作为格式化的唯一真相源。
 *
 * 设计原则:
 *  - `valueFormat` 是唯一真相源；`showPercent` 字段不参与格式化决策（仅为兼容旧数据
 *    保留在结构里，未使用）。
 *  - 公式用递归下降表达式解析器自动识别任意合法算术表达式，不预设公式表。
 *    游戏新增公式（如 `{value*2:0.0%}`）无需改代码即可处理。
 *  - modifierType 严格匹配 attributeModifier；匹配失败 throw，不用 list[0] 回退，
 *    不用 modType 6/8/7 猜测规则。数据调查显示 100% 装备能精确匹配，回退只会掩盖问题。
 *  - 解析/求值失败 throw，暴露上游数据问题，不静默回退。
 * ================================================================================
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseJsonSafe } from './json-utils'
import { loadTextTable } from './stat-mapping'

// ── Types ─────────────────────────────────────────────────────────────────

export interface AttrShowEntry {
  /** 对应 displayAttrModifiers.modifierType，用于精确匹配。 */
  attributeModifier: number
  /** 上游 showPercent 字段，本模块不使用，仅为调试保留。 */
  showPercent: boolean
  /** 形如 `{value:0.0%}` / `{1-value:0.0%}` / `{100-100*value:0}` / `{value}` / `` (空) */
  valueFormat: string
}

export interface AttrShowConfig {
  /** CN 名称（从 list[0].name.id 经 TextTable 解析）。 */
  name: string
  /** 完整 list，每个 attributeModifier 一条。 */
  entries: AttrShowEntry[]
}

// ── Expression evaluator ──────────────────────────────────────────────────
//
// valueFormat 的 formula 部分是只含 `value` 变量、数字字面量、`+ - * /` 和括号的
// 算术表达式。递归下降解析器自动识别任意合法表达式，无需预设公式注册表。
//
// 文法:
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/') factor)*
//   factor := '-' factor | primary
//   primary:= number | 'value' | '(' expr ')'
//
type ExprToken = number | string

function tokenizeExpr(src: string): ExprToken[] {
  const tokens: ExprToken[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i
      while (j < src.length && ((src[j] >= '0' && src[j] <= '9') || src[j] === '.')) j++
      tokens.push(parseFloat(src.slice(i, j)))
      i = j
      continue
    }
    if ('+-*/()'.includes(ch)) { tokens.push(ch); i++; continue }
    if (src.startsWith('value', i)) { tokens.push('value'); i += 5; continue }
    throw new Error(`equip-stat-format: 公式 "${src}" 中存在无法识别的字符 "${ch}"`)
  }
  return tokens
}

interface ExprAst {
  type: 'num' | 'var' | 'binop' | 'neg'
  value?: number
  op?: '+' | '-' | '*' | '/'
  left?: ExprAst
  right?: ExprAst
  operand?: ExprAst
}

function parseExprTokens(tokens: ExprToken[]): ExprAst {
  let pos = 0
  const peek = (): ExprToken | undefined => tokens[pos]
  const next = (): ExprToken => tokens[pos++]

  function parseAddSub(): ExprAst {
    let left = parseMulDiv()
    while (peek() === '+' || peek() === '-') {
      const op = next() as '+' | '-'
      left = { type: 'binop', op, left, right: parseMulDiv() }
    }
    return left
  }
  function parseMulDiv(): ExprAst {
    let left = parseUnary()
    while (peek() === '*' || peek() === '/') {
      const op = next() as '*' | '/'
      left = { type: 'binop', op, left, right: parseUnary() }
    }
    return left
  }
  function parseUnary(): ExprAst {
    if (peek() === '-') { next(); return { type: 'neg', operand: parseUnary() } }
    return parsePrimary()
  }
  function parsePrimary(): ExprAst {
    const t = peek()
    if (typeof t === 'number') { next(); return { type: 'num', value: t } }
    if (t === 'value') { next(); return { type: 'var' } }
    if (t === '(') {
      next()
      const e = parseAddSub()
      if (peek() !== ')') throw new Error(`equip-stat-format: 公式解析错误，期望 ")"`)
      next()
      return e
    }
    throw new Error(`equip-stat-format: 公式解析错误，意外 token "${t ?? '<EOF>'}"`)
  }

  const ast = parseAddSub()
  if (pos < tokens.length) {
    throw new Error(`equip-stat-format: 公式解析错误，多余的 token "${tokens[pos]}"`)
  }
  return ast
}

function evalAst(ast: ExprAst, value: number): number {
  switch (ast.type) {
    case 'num': return ast.value!
    case 'var': return value
    case 'neg': return -evalAst(ast.operand!, value)
    case 'binop': {
      const l = evalAst(ast.left!, value)
      const r = evalAst(ast.right!, value)
      switch (ast.op) {
        case '+': return l + r
        case '-': return l - r
        case '*': return l * r
        case '/': return l / r
      }
      throw new Error(`equip-stat-format: 未知 binop 算子 "${ast.op}"`)
    }
  }
  throw new Error(`equip-stat-format: 未知 AST 节点类型 "${ast.type}"`)
}

// ── valueFormat parsing ───────────────────────────────────────────────────

/** 解析 `{formula:spec}` 形式的 valueFormat。空字符串返回 null。无法解析时 throw。 */
export function parseValueFormat(fmt: string): { formula: string; spec: string } | null {
  if (!fmt) return null
  const m = fmt.match(/^\{([^:}]*)(?::([^}]*))?\}$/)
  if (!m) throw new Error(`equip-stat-format: 无法解析 valueFormat "${fmt}"`)
  return { formula: m[1], spec: m[2] ?? '' }
}

// ── Formatting ────────────────────────────────────────────────────────────

/**
 * 格式化装备属性值。
 *
 * @param name        属性名（attrType number / compositeAttr / 已解析的 key）
 * @param value       上游 attrValue 的字符串形式（lossless-json 保留精度）
 * @param valueFormat 上游 valueFormat 字段（`{value:0.0%}` / `{1-value:0.0%}` / `{value}` / `""` 等）
 *
 * 行为:
 *  - 空 valueFormat → 原始值，无 `%`
 *  - 非空 valueFormat → 解析公式并求值；spec 含 `%` 则结果 ×100 并追加 `%`
 *
 * 精度: toFixed(8) + parseFloat 清理浮点噪声（远超游戏数据 3-4 位精度），与历史行为一致。
 */
export function formatEquipStat(name: string, value: string, valueFormat: string): string {
  const parsed = parseValueFormat(valueFormat)

  // 空 valueFormat: 原始值
  if (!parsed) {
    const num = parseFloat(value)
    return Number.isInteger(num) ? `${name}+${num}` : `${name}+${parseFloat(value)}`
  }

  // 应用公式
  const num = parseFloat(value)
  const result = evalAst(parseExprTokens(tokenizeExpr(parsed.formula)), num)

  // .NET 风格格式说明符: "0.0%" 表示 ×100 加 %, "0" / "" 表示无 %
  const isPercent = parsed.spec.includes('%')
  const scaled = isPercent ? result * 100 : result
  const clean = parseFloat(scaled.toFixed(8))
  const suffix = isPercent ? '%' : ''
  return `${name}+${clean}${suffix}`
}

// ── Modifier resolution ───────────────────────────────────────────────────

/**
 * 按 modifierType 在 cfg.entries 中精确匹配，返回对应的 valueFormat。
 *
 * 严格匹配：找不到直接 throw，不做 list[0] 回退，不用 modType 6/8/7 猜测规则。
 * 数据调查显示当前 618 条装备属性 100% 能精确匹配，0 例需要回退；未来出现不匹配
 * 就该报错暴露问题，而不是用猜测规则掩盖。
 *
 * @param cfg          对应 attrType/compositeAttr 的配置（含完整 list）
 * @param key          attrType number（字符串形式）或 compositeAttr，仅用于错误信息
 * @param modifierType 上游 displayAttrModifiers.modifierType
 */
export function resolveFormat(
  cfg: AttrShowConfig | undefined,
  key: string,
  modifierType: number,
): string {
  if (!cfg || cfg.entries.length === 0) {
    throw new Error(`equip-stat-format: key="${key}" modifierType=${modifierType} 在配置表中无任何条目`)
  }
  const exact = cfg.entries.find(e => e.attributeModifier === modifierType)
  if (!exact) {
    throw new Error(
      `equip-stat-format: key="${key}" modifierType=${modifierType} 未在配置 list 中找到匹配条目; ` +
      `可用 modifier: [${cfg.entries.map(e => e.attributeModifier).join(', ')}]`,
    )
  }
  return exact.valueFormat
}

// ── Config table loaders ──────────────────────────────────────────────────

/**
 * 从上游 AttributeShowConfigTable + CompositeAttributeShowConfigTable 构建
 * attrType / compositeAttr → AttrShowConfig 映射（保留完整 list，含 valueFormat）。
 *
 * 与历史实现不同: 不再只取 list[0] 的 showPercent，而是保留全部 entries，
 * 由 resolveFormat 按 modifierType 精确匹配。
 */
export function buildAttrShowConfigs(akedataPath: string): {
  attrTypeMap: Map<number, AttrShowConfig>
  compositeCfg: Map<string, AttrShowConfig>
} {
  const textTable = loadTextTable(akedataPath, 'zh-CN')
  const attrTypeMap = new Map<number, AttrShowConfig>()
  const compositeCfg = new Map<string, AttrShowConfig>()

  type RawList = { name: { id: string }; attributeModifier: number; showPercent: boolean; valueFormat?: string }[]
  type RawTable = Record<string, { list?: RawList }>

  const attrCfgPath = join(akedataPath, 'TableCfg', 'AttributeShowConfigTable.json')
  if (existsSync(attrCfgPath)) {
    const cfg = parseJsonSafe(attrCfgPath) as RawTable
    for (const [attrTypeStr, data] of Object.entries(cfg)) {
      if (!data.list?.[0]?.name?.id) continue
      const cnName = textTable[data.list[0].name.id]
      if (!cnName) continue
      attrTypeMap.set(Number(attrTypeStr), {
        name: cnName,
        entries: data.list.map(item => ({
          // parseJsonSafe (lossless-json) 把所有数字转成字符串，这里强制转回 number
          attributeModifier: Number(item.attributeModifier),
          showPercent: item.showPercent,
          valueFormat: item.valueFormat ?? '',
        })),
      })
    }
  }

  const compCfgPath = join(akedataPath, 'TableCfg', 'CompositeAttributeShowConfigTable.json')
  if (existsSync(compCfgPath)) {
    const cfg = parseJsonSafe(compCfgPath) as RawTable
    for (const [compositeAttr, data] of Object.entries(cfg)) {
      if (!data.list?.[0]?.name?.id) continue
      const cnName = textTable[data.list[0].name.id]
      if (!cnName) continue
      compositeCfg.set(compositeAttr, {
        name: cnName,
        entries: data.list.map(item => ({
          attributeModifier: Number(item.attributeModifier),
          showPercent: item.showPercent,
          valueFormat: item.valueFormat ?? '',
        })),
      })
    }
  }

  return { attrTypeMap, compositeCfg }
}
