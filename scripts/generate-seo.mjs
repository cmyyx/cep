/**
 * Generate robots.txt and sitemap.xml for pure static export.
 *
 * Output:
 *   public/robots.txt
 *   public/sitemap.xml
 *
 * Environment variables:
 *   SITE_URL — canonical domain (e.g. https://cep.example.com)
 *
 * Usage: node scripts/generate-seo.mjs
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const outDir = resolve(root, 'public')

// Load .env.local if present (local dev), but never override existing env vars (CI)
const envLocalPath = resolve(root, '.env.local')
if (existsSync(envLocalPath)) {
  const lines = readFileSync(envLocalPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    if (!process.env[key]) {
      process.env[key] = trimmed.slice(eqIdx + 1).trim()
    }
  }
}

// ─── Config ───────────────────────────────────────────────────
const SITE_URL = process.env.SITE_URL || 'https://cep.example.com'
// Strip trailing slash
const baseUrl = SITE_URL.replace(/\/+$/, '')

const LOCALES = ['zh-CN', 'zh-TW', 'ja', 'en']
const DEFAULT_LOCALE = 'zh-CN'

// ─── Route definitions ────────────────────────────────────────
// priority: 0.0 – 1.0, changefreq: always|hourly|daily|weekly|monthly|yearly|never
const ROUTES = [
  { path: '',             priority: 0.7, changefreq: 'weekly'  },  // home
  { path: 'essence-planner',      priority: 1.0, changefreq: 'weekly'  },
  { path: 'refinement-planner',   priority: 1.0, changefreq: 'weekly'  },
  { path: 'character-guide',      priority: 1.0, changefreq: 'weekly'  },
  { path: 'banner-calendar',      priority: 0.9, changefreq: 'daily'   },
  { path: 'background-preview',   priority: 0.6, changefreq: 'monthly' },
  { path: 'editor',               priority: 0.6, changefreq: 'monthly' },
  { path: 'about',                priority: 0.5, changefreq: 'monthly' },
  { path: 'account',              priority: 0.3, changefreq: 'monthly' },
  { path: 'login',                priority: 0.3, changefreq: 'monthly' },
  { path: 'settings',             priority: 0.3, changefreq: 'monthly' },
  { path: 'update',               priority: 0.5, changefreq: 'weekly'  },
  { path: 'privacy',              priority: 0.2, changefreq: 'yearly'  },
  { path: 'terms',                priority: 0.2, changefreq: 'yearly'  },
]

// ─── Locale to hreflang mapping ───────────────────────────────
const HREFLANG_MAP = {
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  'ja': 'ja',
  'en': 'en',
}

// ─── Escape XML ───────────────────────────────────────────────
function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ─── Build URL for route + locale ─────────────────────────────
function buildUrl(path, locale) {
  const segment = path ? `/${path}` : ''
  return `${baseUrl}/${locale}${segment}`
}

// ─── Generate sitemap.xml ─────────────────────────────────────
function generateSitemap() {
  const now = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset\n'
  xml += '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
  xml += '  xmlns:xhtml="http://www.w3.org/1999/xhtml"\n'
  xml += '>\n'

  for (const { path, priority, changefreq } of ROUTES) {
    // Use default locale URL as the canonical <loc>
    const defaultUrl = buildUrl(path, DEFAULT_LOCALE)

    xml += '  <url>\n'
    xml += `    <loc>${esc(defaultUrl)}</loc>\n`
    xml += `    <lastmod>${now}</lastmod>\n`
    xml += `    <changefreq>${changefreq}</changefreq>\n`
    xml += `    <priority>${priority}</priority>\n`

    // hreflang alternates for all locales
    for (const locale of LOCALES) {
      const url = buildUrl(path, locale)
      const hreflang = HREFLANG_MAP[locale] || locale
      xml += `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${esc(url)}"/>\n`
    }

    // Self-referencing hreflang with x-default (use default locale)
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(defaultUrl)}"/>\n`

    xml += '  </url>\n'
  }

  xml += '</urlset>\n'

  const outPath = resolve(outDir, 'sitemap.xml')
  writeFileSync(outPath, xml, 'utf-8')
  console.log(`[generate-seo] Wrote sitemap.xml (${ROUTES.length} routes × ${LOCALES.length} locales)`)
}

// ─── Generate robots.txt ──────────────────────────────────────
function generateRobots() {
  const content = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ].join('\n') + '\n'

  const outPath = resolve(outDir, 'robots.txt')
  writeFileSync(outPath, content, 'utf-8')
  console.log(`[generate-seo] Wrote robots.txt`)
}

// ─── Main ─────────────────────────────────────────────────────
console.log(`[generate-seo] SITE_URL = ${baseUrl}`)
generateSitemap()
generateRobots()
console.log('[generate-seo] Done')
