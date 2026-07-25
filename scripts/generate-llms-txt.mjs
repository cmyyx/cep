/**
 * Generate /llms.txt and /llms-full.txt for LLM-friendly site discovery.
 *
 * Spec: https://llmstxt.org/
 *
 * Sources of truth (auto-updating):
 * - List routes: `src/app/sitemap.ts` ROUTES
 * - Wiki detail pages: `src/generated/data/wiki/{characters,weapons,equipment}.ts`
 * - Site origin: `DEFAULT_SITE_URL` in `src/lib/constants.ts` (parsed at generate time)
 *
 * When adding/removing a list route:
 * 1. Edit ROUTES in `src/app/sitemap.ts`
 * 2. Edit ROUTE_META in this file (same path key)
 *    - Missing or orphan meta throws via assertRouteMetaCoverage (prebuild fails)
 *
 * Output:
 * - public/llms.txt       curated index (list routes + wiki indexes only)
 * - public/llms-full.txt  expanded context including every wiki detail URL
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/**
 * Parse DEFAULT_SITE_URL from src/lib/constants.ts so llms links share one source of truth.
 * @param {string} source
 * @returns {string}
 */
export function parseDefaultSiteUrl(source) {
  const match = source.match(/export const DEFAULT_SITE_URL\s*=\s*'([^']+)'/)
  if (!match) {
    throw new Error('Could not find export const DEFAULT_SITE_URL in src/lib/constants.ts')
  }
  return match[1]
}

export const SITE_URL = parseDefaultSiteUrl(
  readFileSync(resolve(root, 'src/lib/constants.ts'), 'utf8'),
)
export const DEFAULT_LOCALE = 'zh-CN'
export const LOCALES = ['zh-CN', 'zh-TW', 'ja', 'en']

/** Paths that must never appear in llms files (auth / account chrome). */
export const SKIP_PATHS = new Set(['account', 'login', 'settings'])

/**
 * Human-readable metadata for sitemap list routes.
 *
 * REQUIRED: every path in `src/app/sitemap.ts` ROUTES must have an entry here,
 * and every key here must exist in ROUTES. Enforced by assertRouteMetaCoverage()
 * during prebuild (`node scripts/generate-llms-txt.mjs`).
 *
 * Checklist when changing routes:
 * 1. Edit ROUTES in `src/app/sitemap.ts`
 * 2. Add/update/remove the matching path key in ROUTE_META below
 *
 * section:
 * - core     → primary tools
 * - wiki     → wiki index pages
 * - optional → secondary / legal / less critical
 * - skip     → omit from llms files (account/login/settings)
 */
export const ROUTE_META = {
  '': {
    section: 'core',
    title: 'Home',
    description: 'CEP Endfield Planner landing page and module overview',
  },
  'essence-planner': {
    section: 'core',
    title: 'Essence Planner',
    description:
      'Multi-weapon essence farming optimization with lock constraints, attribute conflict resolution, and ranked plans',
  },
  'refinement-planner': {
    section: 'core',
    title: 'Refinement Planner',
    description: 'Equipment refinement planning — materials and substat optimization',
  },
  'growth-planner': {
    section: 'core',
    title: 'Growth Planner',
    description:
      'Operator and weapon growth planner for levels, skills, promotions, breakthroughs, and stamina',
  },
  'panel-preview': {
    section: 'core',
    title: 'Stats Preview',
    description:
      'Operator stats preview with configurable operators, equipment, weapons, and full panel attributes',
  },
  'banner-calendar': {
    section: 'core',
    title: 'Banner Calendar',
    description: 'Gacha banner schedule, rerun timeline, and pull planning',
  },
  'background-preview': {
    section: 'core',
    title: 'Background Preview',
    description: 'Preview and select website background artwork',
  },
  forum: {
    section: 'optional',
    title: 'Forum',
    description: 'Community discussion entry',
  },
  about: {
    section: 'optional',
    title: 'About',
    description: 'Project overview, tech stack, features, and open-source information',
  },
  update: {
    section: 'optional',
    title: 'Changelog / Updates',
    description: 'Release notes and forced-update history',
  },
  privacy: {
    section: 'optional',
    title: 'Privacy Policy',
    description: 'How CEP handles account, planning, and analytics data',
  },
  terms: {
    section: 'optional',
    title: 'Terms of Service',
    description: 'Terms of use and AGPL-3.0 open-source notice',
  },
  'wiki/characters': {
    section: 'wiki',
    title: 'Characters Wiki',
    description: 'Operator list with filters; detail pages for every character',
  },
  'wiki/weapons': {
    section: 'wiki',
    title: 'Weapons Wiki',
    description: 'Weapon list with filters; detail pages for every weapon',
  },
  'wiki/equipment': {
    section: 'wiki',
    title: 'Equipment Wiki',
    description: 'Equipment list with filters; detail pages for every gear piece',
  },
  // Explicit skip entries so sitemap coverage checks stay complete
  account: { section: 'skip', title: 'Account', description: '' },
  login: { section: 'skip', title: 'Login', description: '' },
  settings: { section: 'skip', title: 'Settings', description: '' },
}

/**
 * Extract the ROUTES path list from sitemap.ts source text.
 * @param {string} source
 * @returns {string[]}
 */
export function parseSitemapRoutePaths(source) {
  const routesMatch = source.match(/export const ROUTES[\s\S]*?=\s*\[([\s\S]*?)\]\s*/)
  if (!routesMatch) {
    throw new Error('Could not find export const ROUTES array in sitemap.ts')
  }
  const body = routesMatch[1]
  const paths = []
  const pathRe = /path:\s*'([^']*)'/g
  let m
  while ((m = pathRe.exec(body)) !== null) {
    paths.push(m[1])
  }
  if (paths.length === 0) {
    throw new Error('ROUTES array parsed but contained no path entries')
  }
  return paths
}

/**
 * Ensure every sitemap path has ROUTE_META and no orphan meta remains.
 * @param {string[]} sitemapPaths
 * @param {Record<string, { section: string }>} routeMeta
 */
export function assertRouteMetaCoverage(sitemapPaths, routeMeta = ROUTE_META) {
  const missing = sitemapPaths.filter((p) => !(p in routeMeta))
  const orphans = Object.keys(routeMeta).filter((p) => !sitemapPaths.includes(p))
  if (missing.length > 0 || orphans.length > 0) {
    const parts = []
    if (missing.length > 0) {
      parts.push(`Missing ROUTE_META for sitemap paths: ${missing.join(', ')}`)
    }
    if (orphans.length > 0) {
      parts.push(`Orphan ROUTE_META (not in sitemap): ${orphans.join(', ')}`)
    }
    throw new Error(parts.join('\n'))
  }
}

/**
 * Parse a generated wiki summary TS module into plain objects.
 * Expects: `export const wikiX = [ ... ] satisfies SomeType[]`
 * @param {string} source
 * @returns {Array<{ id: string, name: Record<string, string>, rarity?: number }>}
 */
export function parseWikiSummaryArray(source) {
  const start = source.indexOf('= [')
  if (start === -1) {
    throw new Error('Wiki summary file missing "= [" array start')
  }
  const endMarker = source.lastIndexOf('] satisfies')
  if (endMarker === -1) {
    throw new Error('Wiki summary file missing "] satisfies" array end')
  }
  const jsonText = source.slice(start + 2, endMarker + 1)
  /** @type {Array<{ id: string, name: Record<string, string>, rarity?: number }>} */
  const data = JSON.parse(jsonText)
  if (!Array.isArray(data)) {
    throw new Error('Wiki summary parse result is not an array')
  }
  return data
}

/**
 * @param {string} path segment without leading slash; empty = home
 * @param {string} [locale]
 */
export function pageUrl(path, locale = DEFAULT_LOCALE) {
  if (!path) return `${SITE_URL}/${locale}`
  return `${SITE_URL}/${locale}/${path}`
}

/**
 * @param {{ id: string, name: Record<string, string>, rarity?: number }} item
 * @param {'en' | 'zh-CN'} prefer
 */
export function entityLabel(item, prefer = 'en') {
  const name = item.name?.[prefer] || item.name?.en || item.name?.['zh-CN'] || item.id
  const rarity = typeof item.rarity === 'number' ? ` (${item.rarity}★)` : ''
  return `${name}${rarity}`
}

/**
 * @param {string} title
 * @param {string} url
 * @param {string} [description]
 */
export function formatLink(title, url, description) {
  if (description) return `- [${title}](${url}): ${description}`
  return `- [${title}](${url})`
}

/**
 * Curated index — list routes only. Wiki entity details live in llms-full.txt.
 * @param {{
 *   sitemapPaths: string[]
 *   generatedAt?: string
 * }} input
 */
export function buildLlmsTxt(input) {
  const { sitemapPaths, generatedAt } = input
  assertRouteMetaCoverage(sitemapPaths)

  const core = []
  const wiki = []
  const optional = []

  for (const path of sitemapPaths) {
    const meta = ROUTE_META[path]
    if (!meta || meta.section === 'skip') continue
    const line = formatLink(meta.title, pageUrl(path), meta.description)
    if (meta.section === 'core') core.push(line)
    else if (meta.section === 'wiki') wiki.push(line)
    else if (meta.section === 'optional') optional.push(line)
  }

  optional.push(
    formatLink(
      'Sitemap',
      `${SITE_URL}/sitemap.xml`,
      'Full indexable URL list including locale alternates',
    ),
    formatLink(
      'llms-full.txt',
      `${SITE_URL}/llms-full.txt`,
      'Expanded context with every character, weapon, and equipment detail URL',
    ),
  )

  const lines = [
    '# CEP Endfield Planner',
    '',
    '> Free planner suite for Arknights: Endfield — essence farming, equipment refinement, growth planning, banner calendar, stats preview, and game-data wiki.',
    '',
    'CEP (Cep Endfield Planner). Default locale is `zh-CN`; also available in `zh-TW`, `ja`, and `en`.',
    `Official site: ${SITE_URL}`,
    'This project is unofficial fan work and is not affiliated with Hypergryph / Mountain Contour.',
    'Frontend source: https://github.com/cmyyx/cep (AGPL-3.0).',
    generatedAt ? `Generated at: ${generatedAt}` : null,
    '',
    '## Core tools',
    '',
    ...core,
    '',
    '## Wiki',
    '',
    ...wiki,
    '',
    `Wiki detail pages for every character, weapon, and equipment are listed in [llms-full.txt](${SITE_URL}/llms-full.txt).`,
    '',
    '## Optional',
    '',
    ...optional,
    '',
  ].filter((line) => line !== null)

  return lines.join('\n')
}

/**
 * @param {{
 *   characters: Array<{ id: string, name: Record<string, string>, rarity?: number }>
 *   weapons: Array<{ id: string, name: Record<string, string>, rarity?: number }>
 *   equipment: Array<{ id: string, name: Record<string, string>, rarity?: number }>
 *   sitemapPaths: string[]
 *   generatedAt?: string
 * }} input
 */
export function buildLlmsFullTxt(input) {
  const { characters, weapons, equipment, sitemapPaths, generatedAt } = input
  assertRouteMetaCoverage(sitemapPaths)

  const corePaths = sitemapPaths.filter((p) => ROUTE_META[p]?.section === 'core')
  const wikiPaths = sitemapPaths.filter((p) => ROUTE_META[p]?.section === 'wiki')
  const optionalPaths = sitemapPaths.filter((p) => ROUTE_META[p]?.section === 'optional')

  const sections = [
    '# CEP Endfield Planner — Full Context',
    '',
    '> Expanded companion to /llms.txt. Prefer this file when an agent needs a single self-contained document.',
    '',
    '## About the site',
    '',
    'CEP Endfield Planner is a free, open-source planning toolkit for the game Arknights: Endfield.',
    'It helps players optimize essence farming, equipment refinement, operator/weapon growth, and track banners.',
    `Canonical domain: ${SITE_URL}`,
    `Default locale path prefix: /${DEFAULT_LOCALE}/`,
    `Other locales: ${LOCALES.filter((l) => l !== DEFAULT_LOCALE).join(', ')}`,
    'Unofficial fan project — game assets and names belong to their respective rights holders.',
    generatedAt ? `Generated at: ${generatedAt}` : null,
    '',
    '## Core tools',
    '',
  ]

  for (const path of corePaths) {
    const meta = ROUTE_META[path]
    sections.push(`### ${meta.title}`, '', meta.description, '', `- URL: ${pageUrl(path)}`, '')
  }

  sections.push('## Wiki indexes', '')
  for (const path of wikiPaths) {
    const meta = ROUTE_META[path]
    sections.push(`### ${meta.title}`, '', meta.description, '', `- URL: ${pageUrl(path)}`, '')
  }

  sections.push(
    `## Characters (${characters.length})`,
    '',
    'Each character has a detail page under `/wiki/characters/{id}`.',
    '',
  )
  for (const c of characters) {
    sections.push(`- ${entityLabel(c)} — ${pageUrl(`wiki/characters/${c.id}`)}`)
  }

  sections.push(
    '',
    `## Weapons (${weapons.length})`,
    '',
    'Each weapon has a detail page under `/wiki/weapons/{id}`.',
    '',
  )
  for (const w of weapons) {
    sections.push(`- ${entityLabel(w)} — ${pageUrl(`wiki/weapons/${w.id}`)}`)
  }

  sections.push(
    '',
    `## Equipment (${equipment.length})`,
    '',
    'Each equipment piece has a detail page under `/wiki/equipment/{id}`.',
    '',
  )
  for (const e of equipment) {
    sections.push(`- ${entityLabel(e)} — ${pageUrl(`wiki/equipment/${e.id}`)}`)
  }

  sections.push('', '## Optional pages', '')
  for (const path of optionalPaths) {
    const meta = ROUTE_META[path]
    sections.push(formatLink(meta.title, pageUrl(path), meta.description))
  }
  sections.push(
    formatLink('Sitemap', `${SITE_URL}/sitemap.xml`),
    formatLink('llms.txt', `${SITE_URL}/llms.txt`, 'Curated index (same links, shorter notes)'),
    '',
  )

  return sections.filter((line) => line !== null).join('\n')
}

/**
 * Load inputs from the repo and write public/llms*.txt
 */
export function generateLlmsFiles({
  rootDir = root,
  generatedAt = new Date().toISOString(),
} = {}) {
  const sitemapSource = readFileSync(resolve(rootDir, 'src/app/sitemap.ts'), 'utf8')
  const sitemapPaths = parseSitemapRoutePaths(sitemapSource)
  assertRouteMetaCoverage(sitemapPaths)

  const characters = parseWikiSummaryArray(
    readFileSync(resolve(rootDir, 'src/generated/data/wiki/characters.ts'), 'utf8'),
  )
  const weapons = parseWikiSummaryArray(
    readFileSync(resolve(rootDir, 'src/generated/data/wiki/weapons.ts'), 'utf8'),
  )
  const equipment = parseWikiSummaryArray(
    readFileSync(resolve(rootDir, 'src/generated/data/wiki/equipment.ts'), 'utf8'),
  )

  const payload = { characters, weapons, equipment, sitemapPaths, generatedAt }
  const llmsTxt = buildLlmsTxt(payload)
  const llmsFullTxt = buildLlmsFullTxt(payload)

  const llmsPath = resolve(rootDir, 'public/llms.txt')
  const llmsFullPath = resolve(rootDir, 'public/llms-full.txt')
  writeFileSync(llmsPath, llmsTxt, 'utf8')
  writeFileSync(llmsFullPath, llmsFullTxt, 'utf8')

  return {
    llmsPath,
    llmsFullPath,
    counts: {
      routes: sitemapPaths.length,
      characters: characters.length,
      weapons: weapons.length,
      equipment: equipment.length,
      llmsBytes: Buffer.byteLength(llmsTxt, 'utf8'),
      llmsFullBytes: Buffer.byteLength(llmsFullTxt, 'utf8'),
    },
  }
}

function isMain() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(resolve(entry)).href
}

if (isMain()) {
  const result = generateLlmsFiles()
  const { counts } = result
  console.log(
    `[llms.txt] wrote public/llms.txt (${counts.llmsBytes} B) and public/llms-full.txt (${counts.llmsFullBytes} B)`,
  )
  console.log(
    `[llms.txt] routes=${counts.routes} characters=${counts.characters} weapons=${counts.weapons} equipment=${counts.equipment}`,
  )
}
