/**
 * Generate Open Graph images for all routes × locales using satori + sharp.
 *
 * Output: public/og/{route}/{locale}.png (56 images)
 *
 * Font requirements:
 *   - Geist Regular for Latin text (bundled with Next.js @vercel/og)
 *   - CJK TTF font for Chinese/Japanese text (auto-detected from system or bundled)
 *
 * Usage: node scripts/generate-og.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import satori from 'satori'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ─── Locales ──────────────────────────────────────────────────
const LOCALES = ['zh-CN', 'zh-TW', 'ja', 'en']

// ─── Route definitions ────────────────────────────────────────
// { route: URL path segment, titleKey: dot-path into locale JSON }
const ROUTES = [
  { route: 'home', titleKey: 'home.title' },
  { route: 'essence-planner', titleKey: 'nav.essencePlanner' },
  { route: 'refinement-planner', titleKey: 'nav.refinementPlanner' },
  { route: 'character-guide', titleKey: 'nav.characterGuide' },
  { route: 'banner-calendar', titleKey: 'nav.bannerCalendar' },
  { route: 'background-preview', titleKey: 'nav.backgroundPreview' },
  { route: 'editor', titleKey: 'nav.editor' },
  { route: 'about', titleKey: 'nav.about' },
  { route: 'account', titleKey: 'account.title' },
  { route: 'login', titleKey: 'nav.login' },
  { route: 'settings', titleKey: 'settings.title' },
  { route: 'update', titleKey: 'version.version' },
  { route: 'privacy', titleKey: 'legal.privacyTitle' },
  { route: 'terms', titleKey: 'legal.termsTitle' },
]

// ─── Resolve dot-path in a nested object ──────────────────────
function getNested(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

// ─── Load translations ────────────────────────────────────────
function loadMessages(locale) {
  const p = resolve(root, 'src', 'messages', `${locale}.json`)
  return JSON.parse(readFileSync(p, 'utf-8'))
}

// ─── Find Geist font (bundled with Next.js @vercel/og) ────────
function findGeistFont() {
  const candidates = []

  // Primary: import.meta.resolve for Next.js
  try {
    const nextPkgPath = fileURLToPath(import.meta.resolve('next/package.json'))
    const nextDir = dirname(nextPkgPath)
    candidates.push(
      join(nextDir, 'dist', 'compiled', '@vercel', 'og', 'Geist-Regular.ttf')
    )
  } catch { /* ignore */ }

  // Fallback: search pnpm store
  const pnpmBase = join(root, 'node_modules', '.pnpm')
  if (existsSync(pnpmBase)) {
    try {
      const dirs = readdirSync(pnpmBase)
      const nextDir = dirs.find(d => d.startsWith('next@'))
      if (nextDir) {
        candidates.push(
          join(pnpmBase, nextDir, 'node_modules', 'next', 'dist', 'compiled', '@vercel', 'og', 'Geist-Regular.ttf')
        )
      }
    } catch { /* ignore */ }
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return null
}

// ─── Find CJK font (system → bundled → Google Fonts download) ──
async function findCjkFont() {
  const candidates = [
    // Bundled font (user provides)
    join(__dirname, 'lib', 'cjk-font.ttf'),
    // Windows
    'C:\\Windows\\Fonts\\simhei.ttf',
    'C:\\Windows\\Fonts\\NotoSansSC-VF.ttf',
    'C:\\Windows\\Fonts\\msyh.ttf',
    // macOS (only .ttf, not .ttc)
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    // Linux
    '/usr/share/fonts/truetype/noto/NotoSansSC-Regular.ttf',
    '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansSC-Regular.otf',
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  // CI fallback: download Noto Sans SC from Google Fonts
  return await downloadCjkFont()
}

// ─── Download CJK font from Google Fonts ──────────────────────
async function downloadCjkFont() {
  const cacheDir = join(root, 'node_modules', '.cache', 'cep-og-fonts')
  const fontPath = join(cacheDir, 'NotoSansSC-Regular.ttf')

  if (existsSync(fontPath)) {
    // Already cached — but check if it's a valid file
    try {
      const s = statSync(fontPath)
      if (s.size > 100000) return fontPath // >100KB, looks valid
    } catch { /* re-download */ }
  }

  console.log('[generate-og] No system CJK font found. Downloading Noto Sans SC from Google Fonts...')

  mkdirSync(cacheDir, { recursive: true })

  // Google Fonts CSS API → extract the TTF URL, then download
  // Noto Sans SC Regular: https://fonts.google.com/specimen/Noto+Sans+SC
  try {
    const cssUrl =
      'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap'

    const cssResp = await fetch(cssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (CEP-OG-Generator)' },
    })
    if (!cssResp.ok) throw new Error(`HTTP ${cssResp.status}`)
    const cssText = await cssResp.text()

    // Extract TTF URL from @font-face src
    const ttfMatch = cssText.match(/url\((https:\/\/[^)]+\.ttf)\)/)
    if (!ttfMatch) throw new Error('Could not find TTF URL in Google Fonts CSS')

    const ttfUrl = ttfMatch[1]
    console.log(`[generate-og] Downloading from: ${ttfUrl}`)

    const ttfResp = await fetch(ttfUrl)
    if (!ttfResp.ok) throw new Error(`HTTP ${ttfResp.status}`)

    const dest = createWriteStream(fontPath)
    await pipeline(ttfResp.body, dest)

    console.log(`[generate-og] CJK font cached at: ${fontPath}`)
    return fontPath
  } catch (err) {
    console.warn(
      `[generate-og] Failed to download CJK font: ${err.message}`
    )
    return null
  }
}

// ─── Load font as ArrayBuffer ─────────────────────────────────
function loadFont(path) {
  return readFileSync(path).buffer
}

// ─── Read icon as base64 data URI ─────────────────────────────
function loadIconBase64() {
  // Try the website favicon first, fall back to CEP.png
  const candidates = [
    resolve(root, 'src', 'app', 'icon.png'),
    resolve(root, 'public', 'CEP.png'),
  ]
  for (const iconPath of candidates) {
    if (existsSync(iconPath)) {
      const buf = readFileSync(iconPath)
      const b64 = buf.toString('base64')
      return `data:image/png;base64,${b64}`
    }
  }
  return null
}

// ─── Create OG image element tree ─────────────────────────────
function createOgElement(pageTitle, appName, iconBase64) {
  return {
    type: 'div',
    props: {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        position: 'relative',
        fontFamily: '"Geist Sans", "CJK Font", sans-serif',
      },
      children: [
        // Grid background layer
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage:
                'linear-gradient(rgba(128,128,128,0.06) 1px, transparent 1px), ' +
                'linear-gradient(90deg, rgba(128,128,128,0.06) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            },
          },
        },
        // Content
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 28,
            },
            children: [
              // Icon
              iconBase64
                ? {
                    type: 'img',
                    props: {
                      src: iconBase64,
                      width: 80,
                      height: 80,
                      style: { width: 80, height: 80 },
                    },
                  }
                : null,
              // Page title
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 52,
                    fontWeight: 600,
                    color: '#171717',
                    letterSpacing: '-0.04em',
                    textAlign: 'center',
                    maxWidth: 1000,
                    lineHeight: 1.2,
                  },
                  children: pageTitle,
                },
              },
              // App name
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 20,
                    fontWeight: 500,
                    color: '#4d4d4d',
                    letterSpacing: '-0.02em',
                    textAlign: 'center',
                  },
                  children: appName,
                },
              },
            ].filter(Boolean),
          },
        },
        // Bottom gradient accent bar
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundImage:
                'linear-gradient(90deg, #0a72ef 0%, #de1d8d 50%, #ff5b4f 100%)',
            },
          },
        },
      ],
    },
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('[generate-og] Starting OG image generation...')

  // Locate fonts
  const geistPath = findGeistFont()
  if (!geistPath) {
    console.error(
      '[generate-og] ERROR: Geist font not found. ' +
        'Make sure next is installed.'
    )
    process.exit(1)
  }
  console.log(`[generate-og] Geist font: ${geistPath}`)

  const cjkPath = await findCjkFont()
  if (cjkPath) {
    console.log(`[generate-og] CJK font: ${cjkPath}`)
  } else {
    console.warn(
      '[generate-og] WARNING: No CJK font found. ' +
        'CJK characters will render as tofu (□).\n' +
        '  Place a CJK TTF font at scripts/lib/cjk-font.ttf or install Noto Sans SC.\n' +
        '  Common options: Noto Sans SC, SimHei, Microsoft YaHei (must be .ttf, not .ttc).'
    )
  }

  // Load fonts
  const fonts = [
    {
      name: '"Geist Sans"',
      data: loadFont(geistPath),
      weight: 400,
      style: 'normal',
    },
    {
      name: '"Geist Sans"',
      data: loadFont(geistPath),
      weight: 500,
      style: 'normal',
    },
    {
      name: '"Geist Sans"',
      data: loadFont(geistPath),
      weight: 600,
      style: 'normal',
    },
  ]

  if (cjkPath) {
    const cjkData = loadFont(cjkPath)
    fonts.push(
      {
        name: '"CJK Font"',
        data: cjkData,
        weight: 400,
        style: 'normal',
      },
      {
        name: '"CJK Font"',
        data: cjkData,
        weight: 500,
        style: 'normal',
      },
      {
        name: '"CJK Font"',
        data: cjkData,
        weight: 600,
        style: 'normal',
      },
    )
  }

  // Load icon
  const iconBase64 = loadIconBase64()
  if (!iconBase64) {
    console.warn('[generate-og] WARNING: public/CEP.png not found, skipping icon.')
  }

  // Pre-load messages for all locales
  const messagesCache = {}
  for (const locale of LOCALES) {
    messagesCache[locale] = loadMessages(locale)
  }

  // Generate OG images
  let generated = 0
  const outDir = resolve(root, 'public', 'og')

  for (const { route, titleKey } of ROUTES) {
    const routeDir = join(outDir, route)
    if (!existsSync(routeDir)) {
      mkdirSync(routeDir, { recursive: true })
    }

    for (const locale of LOCALES) {
      const msg = messagesCache[locale]
      const pageTitle = getNested(msg, titleKey) || titleKey
      const appName = getNested(msg, 'app.name') || 'CEP'

      const element = createOgElement(pageTitle, appName, iconBase64)

      const svg = await satori(element, {
        width: 1200,
        height: 630,
        fonts,
      })

      // Render SVG to PNG with sharp
      const png = await sharp(Buffer.from(svg)).png().toBuffer()
      const outPath = join(routeDir, `${locale}.png`)
      writeFileSync(outPath, png)
      generated++
    }
  }

  console.log(`[generate-og] Done — ${generated} OG images generated in public/og/`)
}

main().catch((err) => {
  console.error('[generate-og] Fatal error:', err)
  process.exit(1)
})
