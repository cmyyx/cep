import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Guards the shadow half of the design system's token layer.
 *
 * DESIGN.md replaces CSS borders with `box-shadow` hairlines, so every visible
 * boundary in the app is a shadow colour. The light theme paints them with black
 * at a low alpha; reused verbatim on the `#0a0a0a` dark canvas that resolves to
 * ~1.00:1 contrast — mathematically invisible. That is exactly the bug this test
 * exists to prevent: adding a `--shadow-*` token to `:root` without a `.dark`
 * counterpart silently deletes a divider in dark mode.
 */

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')

/** `:root { … }` / `.dark { … }` hold flat declaration lists — no nested braces. */
function readBlock(selector: string): string {
  const match = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css)
  if (!match) throw new Error(`globals.css has no \`${selector}\` block`)
  // Strip comments so commented-out examples never register as declarations.
  return match[1].replace(/\/\*[\s\S]*?\*\//g, '')
}

function readShadowTokens(selector: string): Map<string, string> {
  const tokens = new Map<string, string>()
  for (const declaration of readBlock(selector).split(';')) {
    const [rawName, ...rawValue] = declaration.split(':')
    const name = rawName.trim()
    if (!name.startsWith('--shadow-')) continue
    tokens.set(name, rawValue.join(':').trim().replace(/\s+/g, ' '))
  }
  return tokens
}

function readColorToken(selector: string, name: string): string {
  const match = new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;]+);`).exec(readBlock(selector))
  if (!match) throw new Error(`\`${selector}\` has no \`${name}\``)
  return match[1].trim()
}

/** Splits a multi-layer box-shadow on top-level commas only. */
function shadowLayers(value: string): string[] {
  const layers: string[] = []
  let depth = 0
  let current = ''
  for (const char of value) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      layers.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) layers.push(current.trim())
  return layers
}

type Rgba = { r: number; g: number; b: number; a: number }

function parseColor(input: string): Rgba {
  const functional = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/.exec(input)
  if (functional) {
    return {
      r: Number(functional[1]),
      g: Number(functional[2]),
      b: Number(functional[3]),
      a: functional[4] === undefined ? 1 : Number(functional[4]),
    }
  }
  const hex = /#([0-9a-f]{6})\b/i.exec(input)
  if (hex) {
    const int = Number.parseInt(hex[1], 16)
    return { r: (int >> 16) & 0xff, g: (int >> 8) & 0xff, b: int & 0xff, a: 1 }
  }
  throw new Error(`cannot parse a colour out of \`${input}\``)
}

/** WCAG 2.x relative luminance: sRGB → linear, then the 0.2126/0.7152/0.0722 mix. */
function relativeLuminance({ r, g, b }: Omit<Rgba, 'a'>): number {
  const linear = [r, g, b].map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/** Alpha-composites `over` on top of the opaque `under` colour. */
function composite(over: Rgba, under: Rgba): Omit<Rgba, 'a'> {
  return {
    r: over.r * over.a + under.r * (1 - over.a),
    g: over.g * over.a + under.g * (1 - over.a),
    b: over.b * over.a + under.b * (1 - over.a),
  }
}

/** WCAG 2.x contrast ratio: (L_lighter + 0.05) / (L_darker + 0.05). */
function contrastRatio(a: Omit<Rgba, 'a'>, b: Omit<Rgba, 'a'>): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Contrast of a token's first shadow layer against a canvas colour. The first
 * layer is the border substitute in every token here; later layers are ambient
 * depth. Insets are measured against the canvas too — an approximation, since
 * they actually sit on the element's own (usually tinted) surface.
 */
function hairlineContrast(tokenValue: string, background: Rgba): number {
  return contrastRatio(composite(parseColor(shadowLayers(tokenValue)[0]), background), background)
}

const lightShadows = readShadowTokens(':root')
const darkShadows = readShadowTokens('\\.dark')
const lightBackground = parseColor(readColorToken(':root', '--background'))
const darkBackground = parseColor(readColorToken('\\.dark', '--background'))

/**
 * Tokens whose first layer *is* a border substitute, so it has to stay
 * discernible against the canvas in both themes.
 *
 * 1.12:1 is not a text-contrast threshold — it is the empirical floor that
 * separates the system's real hairlines (1.14–1.29:1 in both themes) from a
 * light-theme colour leaking onto the dark canvas (~1.005:1).
 */
const HAIRLINE_TOKENS = [
  '--shadow-border',
  '--shadow-ring',
  '--shadow-border-t',
  '--shadow-border-b',
  '--shadow-border-l',
  '--shadow-border-r',
  '--shadow-border-inset-t',
  '--shadow-border-inset-b',
  '--shadow-border-strong',
  '--shadow-card',
]

/** Depth, not boundaries — deliberately below the hairline floor. */
const ELEVATION_TOKENS = ['--shadow-card-inner', '--shadow-raised']

const MIN_HAIRLINE_CONTRAST = 1.12

describe('globals.css shadow tokens', () => {
  it('redefines every :root shadow token inside .dark', () => {
    const missing = [...lightShadows.keys()].filter((name) => !darkShadows.has(name))
    expect(missing).toEqual([])
    expect(lightShadows.size).toBeGreaterThan(0)
  })

  it('never lets .dark inherit a :root shadow value verbatim', () => {
    const unchanged = [...lightShadows].filter(([name, value]) => darkShadows.get(name) === value)
    expect(unchanged).toEqual([])
  })

  it('adds no .dark shadow token that :root does not declare', () => {
    const orphans = [...darkShadows.keys()].filter((name) => !lightShadows.has(name))
    expect(orphans).toEqual([])
  })

  it('classifies every shadow token as a hairline or an elevation', () => {
    // Forces a new token to be triaged here, which is what pulls it into the
    // contrast assertions below instead of letting it slip through unchecked.
    const unclassified = [...lightShadows.keys()].filter(
      (name) => !HAIRLINE_TOKENS.includes(name) && !ELEVATION_TOKENS.includes(name),
    )
    expect(unclassified).toEqual([])
  })

  it('keeps every hairline token above the visibility floor in both themes', () => {
    for (const name of HAIRLINE_TOKENS) {
      const light = lightShadows.get(name)
      const dark = darkShadows.get(name)
      expect(light, `${name} missing from :root`).toBeDefined()
      expect(dark, `${name} missing from .dark`).toBeDefined()
      expect(
        hairlineContrast(light as string, lightBackground),
        `${name} is invisible on the light canvas`,
      ).toBeGreaterThan(MIN_HAIRLINE_CONTRAST)
      expect(
        hairlineContrast(dark as string, darkBackground),
        `${name} is invisible on the dark canvas`,
      ).toBeGreaterThan(MIN_HAIRLINE_CONTRAST)
    }
  })

  it('proves the translucent light hairlines would vanish on the dark canvas', () => {
    // The failure mode the .dark overrides exist to prevent. Opaque light
    // tokens (--shadow-ring is a solid #ebebeb) are exempt: they stay visible
    // on #0a0a0a, they just read as a bright line in the wrong direction.
    for (const name of HAIRLINE_TOKENS) {
      const light = lightShadows.get(name) as string
      if (parseColor(shadowLayers(light)[0]).a === 1) continue
      expect(
        hairlineContrast(light, darkBackground),
        `${name}'s light value is unexpectedly visible on #0a0a0a`,
      ).toBeLessThan(1.05)
    }
  })

  it('keeps the dark hairlines achromatic white rather than tinted', () => {
    for (const name of HAIRLINE_TOKENS) {
      const { r, g, b } = parseColor(shadowLayers(darkShadows.get(name) as string)[0])
      expect(r, `${name} dark hairline is tinted`).toBe(g)
      expect(g, `${name} dark hairline is tinted`).toBe(b)
    }
  })
})
