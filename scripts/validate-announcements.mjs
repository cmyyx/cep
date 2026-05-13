import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const announcementsDir = resolve(root, 'public', 'announcements')
const indexPath = join(announcementsDir, 'index.json')

// ─── Helpers ────────────────────────────────────────────────────────────

let errors = 0
let warnings = 0

function error(msg) {
  console.error(`\x1b[31m[P0]\x1b[0m ${msg}`)
  errors++
}

function warn(msg) {
  console.warn(`\x1b[33m[P1]\x1b[0m ${msg}`)
  warnings++
}

function info(msg) {
  console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`)
}

function isValidISODate(str) {
  if (typeof str !== 'string') return false
  const d = new Date(str)
  return !isNaN(d.getTime())
}

/**
 * Extract image paths from a markdown string.
 * Matches: ![alt](path) and <img src="path">
 * Returns relative or absolute paths as written in the markdown.
 */
function extractImagePaths(mdContent) {
  const paths = []
  // Markdown image: ![alt](path)
  const mdRegex = /!\[.*?\]\(([^)\s]+)\)/g
  let match
  while ((match = mdRegex.exec(mdContent)) !== null) {
    paths.push(match[1])
  }
  // HTML img: <img src="path">
  const htmlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  while ((match = htmlRegex.exec(mdContent)) !== null) {
    paths.push(match[1])
  }
  return paths
}

/**
 * Resolve an image path from .md to a filesystem path under public/announcements/.
 * Handles:
 *   /announcements/xxx.jpg  → public/announcements/xxx.jpg
 *   ./xxx.jpg              → public/announcements/xxx.jpg (relative to .md)
 *   xxx.jpg                → public/announcements/xxx.jpg (bare filename)
 */
function resolveImagePath(imagePath, mdFileName) {
  // Absolute from site root: /announcements/xxx
  if (imagePath.startsWith('/announcements/')) {
    return resolve(root, 'public', imagePath.slice(1))
  }
  // Relative to .md file
  if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
    const mdDir = dirname(resolve(announcementsDir, mdFileName))
    return resolve(mdDir, imagePath)
  }
  // Bare filename or relative without ./
  return resolve(announcementsDir, imagePath)
}

// ─── Main ───────────────────────────────────────────────────────────────

console.log('Validating announcements...\n')

// 1. Check index.json exists
if (!existsSync(indexPath)) {
  error(`index.json not found at ${indexPath}`)
  process.exit(1)
}

let indexData
try {
  const raw = readFileSync(indexPath, 'utf-8')
  indexData = JSON.parse(raw)
} catch (e) {
  error(`Failed to parse index.json: ${e.message}`)
  process.exit(1)
}

if (!Array.isArray(indexData)) {
  error('index.json must be an array')
  process.exit(1)
}

if (indexData.length === 0) {
  warn('index.json is empty — no announcements configured')
  console.log(`\nDone: ${errors} error(s), ${warnings} warning(s)`)
  process.exit(errors > 0 ? 1 : 0)
}

// 2. Validate each entry
const seenIds = new Set()
const existingFiles = new Set(readdirSync(announcementsDir))

// Build set of all files in announcementsDir (flattened, no subdirs)
// We already have existingFiles from readdirSync

for (let i = 0; i < indexData.length; i++) {
  const item = indexData[i]
  const prefix = `[${i}] ${item.id || '(no id)'}`

  // ── Required fields ──
  if (!item.id || typeof item.id !== 'string') {
    error(`${prefix}: missing or invalid "id"`)
    continue
  }
  if (seenIds.has(item.id)) {
    error(`${prefix}: duplicate "id"`)
    continue
  }
  seenIds.add(item.id)

  if (!item.title || typeof item.title !== 'string') {
    error(`${prefix}: missing or invalid "title"`)
    // continue anyway to check other fields
  }

  if (!item.publishTime || !isValidISODate(item.publishTime)) {
    error(`${prefix}: missing or invalid "publishTime" (must be ISO 8601)`)
  }

  if (item.priority && !['normal', 'important'].includes(item.priority)) {
    warn(`${prefix}: unknown priority "${item.priority}" — using "normal"`)
  }

  // ── Content source: file or content ──
  const hasFile = typeof item.file === 'string' && item.file.length > 0
  const hasContent = typeof item.content === 'string' && item.content.length > 0

  if (!hasFile && !hasContent) {
    error(`${prefix}: must have either "file" or "content"`)
    continue
  }

  // ── .md file validation ──
  if (hasFile) {
    const mdPath = join(announcementsDir, item.file)

    if (!existsSync(mdPath)) {
      error(`${prefix}: referenced file "${item.file}" does not exist`)
    } else {
      // Read and validate .md content
      let mdContent
      try {
        mdContent = readFileSync(mdPath, 'utf-8')
      } catch (e) {
        error(`${prefix}: failed to read "${item.file}": ${e.message}`)
        continue
      }

      if (mdContent.trim().length === 0) {
        warn(`${prefix}: "${item.file}" is empty`)
      }

      // Validate image references
      const imagePaths = extractImagePaths(mdContent)

      for (const imgPath of imagePaths) {
        // Skip external URLs
        if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
          continue
        }

        const resolved = resolveImagePath(imgPath, item.file)

        if (!existsSync(resolved)) {
          error(`${prefix}: image not found: "${imgPath}" (resolved to ${resolved})`)
        }
      }

      // Check for unreferenced images that might be orphaned (P2 — info only)
      // Handled below as a cross-check
    }

    // Warn if both file and content are present (redundant but not harmful)
    if (hasContent) {
      info(`${prefix}: both "file" and "content" present — "file" takes priority at runtime`)
    }
  }
}

// 3. Cross-check: find .md files in the directory that are not referenced in index.json
const referencedFiles = new Set(
  indexData
    .filter((item) => typeof item.file === 'string' && item.file.length > 0)
    .map((item) => item.file)
)

for (const file of existingFiles) {
  const ext = extname(file).toLowerCase()
  if (ext !== '.md') continue
  if (!referencedFiles.has(file)) {
    warn(`Unreferenced .md file: "${file}" — not linked from index.json`)
  }
}

// ─── Summary ────────────────────────────────────────────────────────────

console.log(`\nDone: ${errors} error(s), ${warnings} warning(s)\n`)

if (errors > 0) {
  console.error('\x1b[31mVALIDATION FAILED\x1b[0m — fix errors above before building.\n')
  process.exit(1)
} else {
  console.log('\x1b[32mVALIDATION PASSED\x1b[0m\n')
  process.exit(0)
}
