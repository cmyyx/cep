#!/usr/bin/env node
// Quick-create a new announcement .md file and register it in index.json.
// Usage:
//   pnpm note "公告标题"
//   pnpm note "公告标题" important
// ================================================================================

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const announcementsDir = resolve(root, 'public', 'announcements')
const indexPath = join(announcementsDir, 'index.json')

// ── Parse positional args ───────────────────────────────────────────────────

const arg1 = process.argv[2]
const arg2 = process.argv[3]

if (!arg1 || arg1 === '--help' || arg1 === '-h') {
  console.log([
    'Usage: pnpm note "公告标题" [important]',
    '',
    '  First arg  = title (required, use quotes)',
    '  Second arg = "important" for high-priority, omit for normal',
    '',
    'Examples:',
    '  pnpm note "服务器维护通知"',
    '  pnpm note "紧急：数据迁移通知" important',
  ].join('\n'))
  process.exit(0)
}

const title = arg1
let priority = 'normal'
if (arg2) {
  const p = arg2.toLowerCase()
  if (p === 'important' || p === 'i') {
    priority = 'important'
  } else if (p !== 'normal' && p !== 'n') {
    console.error(`Invalid priority "${arg2}". Use "important" or omit for normal.`)
    process.exit(1)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0') }

/** Return ISO 8601 with +08:00 offset from local time (assumes system is +8). */
function localISO() {
  const d = new Date()
  const off = -d.getTimezoneOffset() // minutes
  const offH = Math.floor(Math.abs(off) / 60)
  const offM = Math.abs(off) % 60
  const sign = off >= 0 ? '+' : '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(offH)}:${pad(offM)}`
}

function generateFilename() {
  const d = new Date()
  const prefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-`

  let maxN = 0
  if (existsSync(announcementsDir)) {
    for (const file of readdirSync(announcementsDir)) {
      if (file.startsWith(prefix) && file.endsWith('.md')) {
        const n = parseInt(file.slice(prefix.length, -3), 10)
        if (!isNaN(n) && n > maxN) maxN = n
      }
    }
  }
  return `${prefix}${pad(maxN + 1)}.md`
}

function openFile(filePath) {
  try {
    if (process.platform === 'win32') {
      execSync(`start "" "${filePath}"`, { shell: true, stdio: 'ignore' })
    } else if (process.platform === 'darwin') {
      execSync(`open "${filePath}"`, { stdio: 'ignore' })
    } else {
      execSync(`xdg-open "${filePath}"`, { stdio: 'ignore' })
    }
    console.log(`  Opened in default editor.`)
  } catch {
    console.log(`  (Could not auto-open — file at: ${filePath})`)
  }
}

// ── Load index.json ─────────────────────────────────────────────────────────

let indexData = []
if (existsSync(indexPath)) {
  try {
    indexData = JSON.parse(readFileSync(indexPath, 'utf-8'))
  } catch (e) {
    console.error(`Failed to parse index.json: ${e.message}`)
    process.exit(1)
  }
}

// ── Duplicate checks ────────────────────────────────────────────────────────

const filename = generateFilename()
const id = `announce-${filename.replace('.md', '')}`

if (indexData.some((e) => e.id === id)) {
  console.error(`Duplicate id "${id}" — file already referenced in index.json.`)
  process.exit(1)
}
if (indexData.some((e) => e.title === title)) {
  console.error(`Duplicate title "${title}" — already exists in index.json.`)
  console.error('Use a different title or edit the existing announcement.')
  process.exit(1)
}

// ── Create .md file (no metadata comments — index.json is the source of truth) ─

const filePath = join(announcementsDir, filename)
const mdContent = `## ${title}\n\n\n`
mkdirSync(announcementsDir, { recursive: true })
writeFileSync(filePath, mdContent, 'utf-8')
console.log(`\nCreated: public/announcements/${filename}`)

// ── Add to index.json ───────────────────────────────────────────────────────

indexData.push({ id, title, file: filename, publishTime: localISO(), priority })
indexData.sort((a, b) => new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime())
writeFileSync(indexPath, JSON.stringify(indexData, null, 2) + '\n', 'utf-8')
console.log(`Updated: public/announcements/index.json (${indexData.length} entries)`)

openFile(filePath)
console.log(`\nDone. Write content, then git commit.\n`)
