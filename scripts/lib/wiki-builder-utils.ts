import type { LocalizedText, WikiLocale } from '../../src/types/wiki'

export type Numeric = number | string
export interface TextRef {
  id?: Numeric
}
export interface BlackboardValue {
  key?: string
  value?: Numeric
}
export type WikiTextTables = Record<string, Record<string, string>>

const LOCALES: WikiLocale[] = ['zh-CN', 'en', 'ja', 'zh-TW']

export function numberValue(value: Numeric | undefined, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function cleanWikiText(value: string): string {
  const preservedTags: string[] = []
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(
      /<(?:[@#][A-Za-z0-9._-]+|\/|image="[A-Za-z0-9_./-]+"\s+scale=[0-9.]+)>/g,
      (tag) => {
        const token = `\uE000${preservedTags.length}\uE001`
        preservedTags.push(tag)
        return token
      }
    )
    .replace(/<[^>]*>/g, '')
    .replace(/\uE000(\d+)\uE001/g, (_token, index: string) => preservedTags[Number(index)] ?? '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .trim()
}

export function localizeWikiText(
  ref: TextRef | undefined,
  tables: WikiTextTables
): LocalizedText {
  const id = ref?.id === undefined ? '' : String(ref.id)
  const fallback = cleanWikiText(tables['zh-CN']?.[id] ?? id)
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, cleanWikiText(tables[locale]?.[id] || fallback)])
  ) as LocalizedText
}

function formatWikiNumber(value: number, format: string | undefined): string {
  if (format?.includes('%')) {
    const decimalMatch = format.match(/\.(0+)/)
    const decimals = decimalMatch?.[1].length ?? 0
    return `${(value * 100).toFixed(decimals)}%`
  }
  if (format === '0') return Math.round(value).toString()
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100_000) / 100_000)
}

export function evaluateWikiExpression(
  expression: string,
  values: Readonly<Record<string, number>>
): number | undefined {
  const lookup = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  )
  let cursor = 0
  const skipSpaces = () => {
    while (/\s/.test(expression[cursor] ?? '')) cursor += 1
  }
  const parsePrimary = (): number | undefined => {
    skipSpaces()
    if (expression[cursor] === '(') {
      cursor += 1
      const value = parseAdditive()
      skipSpaces()
      if (expression[cursor] !== ')') return undefined
      cursor += 1
      return value
    }
    const numberMatch = expression.slice(cursor).match(/^(?:\d+(?:\.\d*)?|\.\d+)/)
    if (numberMatch) {
      cursor += numberMatch[0].length
      return Number(numberMatch[0])
    }
    const identifier = expression.slice(cursor).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0]
    if (!identifier) return undefined
    cursor += identifier.length
    return lookup[identifier.toLowerCase()]
  }
  const parseUnary = (): number | undefined => {
    skipSpaces()
    if (expression[cursor] === '+' || expression[cursor] === '-') {
      const sign = expression[cursor]
      cursor += 1
      const value = parseUnary()
      return value === undefined ? undefined : sign === '-' ? -value : value
    }
    return parsePrimary()
  }
  const parseMultiplicative = (): number | undefined => {
    let left = parseUnary()
    if (left === undefined) return undefined
    while (true) {
      skipSpaces()
      const operator = expression[cursor]
      if (operator !== '*' && operator !== '/') return left
      cursor += 1
      const right = parseUnary()
      if (right === undefined || (operator === '/' && right === 0)) return undefined
      left = operator === '*' ? left * right : left / right
    }
  }
  function parseAdditive(): number | undefined {
    let left = parseMultiplicative()
    if (left === undefined) return undefined
    while (true) {
      skipSpaces()
      const operator = expression[cursor]
      if (operator !== '+' && operator !== '-') return left
      cursor += 1
      const right = parseMultiplicative()
      if (right === undefined) return undefined
      left = operator === '+' ? left + right : left - right
    }
  }
  const result = parseAdditive()
  skipSpaces()
  return result !== undefined && cursor === expression.length && Number.isFinite(result)
    ? result
    : undefined
}

export function resolveWikiDescription(
  template: string,
  values: Readonly<Record<string, number>>
): string {
  return cleanWikiText(template).replace(
    /\{([^}:]+)(?::([^}]+))?\}/g,
    (placeholder, expression: string, format: string | undefined) => {
      const value = evaluateWikiExpression(expression, values)
      return value === undefined ? placeholder : formatWikiNumber(value, format)
    }
  )
}

export function localizeWikiDescription(
  ref: TextRef | undefined,
  tables: WikiTextTables,
  values: Readonly<Record<string, number>>
): LocalizedText {
  const localized = localizeWikiText(ref, tables)
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, resolveWikiDescription(localized[locale], values)])
  ) as LocalizedText
}

export function collectWikiBlackboard(
  values: ReadonlyArray<BlackboardValue> | undefined
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of values ?? []) {
    if (item.key && item.value !== undefined) result[item.key] = numberValue(item.value)
  }
  return result
}
