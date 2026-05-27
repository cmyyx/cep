import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname, relative, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const announcementsDir = resolve(root, 'public', 'announcements')
const indexPath = join(announcementsDir, 'index.json')
const generatedPath = join(announcementsDir, 'index.generated.json')

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

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: root, encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

/**
 * Get the first commit time for a file (when it was introduced into the repo).
 * Uses --diff-filter=A to find the commit that first Added the file.
 * Falls back to using --reverse to get earliest commit if --diff-filter=A is not supported.
 */
function gitFirstCommitTime(filePath) {
  const rel = relative(root, filePath).replace(/\\/g, '/')
  // Primary: use --diff-filter=A to find the "add" commit
  let result = git(`log --diff-filter=A --format="%cI" --follow -- "${rel}"`)
  if (result) return result.split('\n').pop()?.trim() || '' // last line = earliest commit
  // Fallback: reverse chronological order, take first
  result = git(`log --reverse --format="%cI" -- "${rel}"`)
  if (result) return result.split('\n')[0]?.trim() || ''
  return ''
}

/**
 * Get the last commit time for a file.
 */
function gitLastCommitTime(filePath) {
  const rel = relative(root, filePath).replace(/\\/g, '/')
  return git(`log -1 --format="%cI" -- "${rel}"`)
}

/**
 * Get the first commit time where a specific string was introduced in a file.
 * Uses git log -S (pickaxe) to find commits that introduced/removed the string.
 */
function gitFirstCommitForString(filePath, searchStr) {
  const rel = relative(root, filePath).replace(/\\/g, '/')
  // -S searches for commits that changed the number of occurrences of the string
  // Reverse to get earliest first
  let result = git(`log --reverse --format="%cI" -S "${searchStr}" -- "${rel}"`)
  if (result) return result.split('\n')[0]?.trim() || ''
  return ''
}

/**
 * Get the last commit time where a specific string was modified in a file.
 */
function gitLastCommitForString(filePath, searchStr) {
  const rel = relative(root, filePath).replace(/\\/g, '/')
  return git(`log -1 --format="%cI" -S "${searchStr}" -- "${rel}"`)
}

/**
 * Resolve publishTime with fallback chain:
 *   1. Git first-commit time of .md file（权威来源）
 *   2. Manual override from index.json（git 不可用时的 fallback）
 *   3. File system birthtime
 *   4. File system mtime (guaranteed)
 */
function resolvePublishTime(item, filePath) {
  const manualTime = typeof item.publishTime === 'string' && item.publishTime.length > 0
    ? item.publishTime
    : null

  // 1. Git first-commit time
  const gitTime = gitFirstCommitTime(filePath)
  if (gitTime) {
    if (manualTime && manualTime !== gitTime) {
      info(`${item.id}: git first-commit (${gitTime}) overrides manual publishTime (${manualTime})`)
    }
    return gitTime
  }

  // 2. Manual override — fallback when git is unavailable
  if (manualTime) {
    const d = new Date(manualTime)
    if (!isNaN(d.getTime())) {
      info(`${item.id}: git unavailable — using manual publishTime (${manualTime})`)
      return manualTime
    }
    warn(`${item.id}: invalid manual publishTime "${manualTime}" — falling back to filesystem`)
  }

  // 3. File system birthtime
  try {
    const stats = statSync(filePath)
    if (stats.birthtime && !isNaN(stats.birthtime.getTime())) {
      const bt = stats.birthtime.toISOString()
      info(`${item.id}: using filesystem birthtime (${bt}) as publishTime`)
      return bt
    }
  } catch {
    // stat failed — should not happen if file exists, but be safe
  }

  // 4. File system mtime (guaranteed if file exists)
  try {
    const stats = statSync(filePath)
    const mt = stats.mtime.toISOString()
    info(`${item.id}: using filesystem mtime (${mt}) as publishTime`)
    return mt
  } catch {
    // Should never reach here if file existence was validated
    error(`${item.id}: cannot stat file for publishTime — file path: ${filePath}`)
    return new Date().toISOString()
  }
}

/**
 * Resolve updatedTime with fallback chain:
 *   1. Git last-commit time of .md file
 *   2. File system mtime
 */
function resolveUpdatedTime(item, filePath) {
  // 1. Git last-commit time
  const gitTime = gitLastCommitTime(filePath)
  if (gitTime) return gitTime

  // 2. File system mtime
  try {
    const stats = statSync(filePath)
    return stats.mtime.toISOString()
  } catch {
    return ''
  }
}

/**
 * Resolve times for an inline content entry (no file field).
 */
function resolveInlineTimes(item) {
  let publishTime = item.publishTime
  let updatedTime = ''

  // publishTime: must be manual for inline entries
  if (typeof publishTime !== 'string' || publishTime.length === 0) {
    // Try git pickaxe on index.json
    const gitTime = gitFirstCommitForString(indexPath, item.id)
    if (gitTime) {
      publishTime = gitTime
      info(`${item.id}: inline entry — derived publishTime from git (${gitTime})`)
    } else {
      // Fall back to index.json mtime
      try {
        publishTime = statSync(indexPath).mtime.toISOString()
        warn(`${item.id}: inline entry has no publishTime — using index.json mtime (${publishTime})`)
      } catch {
        error(`${item.id}: inline entry has no publishTime and index.json is not stat-able`)
        publishTime = new Date().toISOString()
      }
    }
  }

  // updatedTime
  const gitUpdated = gitLastCommitForString(indexPath, item.id)
  if (gitUpdated) {
    updatedTime = gitUpdated
  } else {
    try {
      updatedTime = statSync(indexPath).mtime.toISOString()
    } catch {
      // leave empty
    }
  }

  return { publishTime, updatedTime }
}

// ─── Main ───────────────────────────────────────────────────────────────

console.log('Generating announcement metadata from git history...\n')

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

const generated = []

for (const item of indexData) {
  if (typeof item !== 'object' || item === null) {
    error(`Skipping invalid item: expected object, got ${typeof item}`)
    continue
  }
  if (!item.id || typeof item.id !== 'string') {
    error('Skipping item with missing/invalid id')
    continue
  }

  let publishTime
  let updatedTime = ''

  const hasFile = typeof item.file === 'string' && item.file.length > 0

  if (hasFile) {
    const filePath = resolve(announcementsDir, item.file)

    if (!existsSync(filePath)) {
      error(`${item.id}: referenced file "${item.file}" does not exist — P0, skipping`)
      continue
    }

    publishTime = resolvePublishTime(item, filePath)
    updatedTime = resolveUpdatedTime(item, filePath)
  } else {
    // Inline content entry
    const resolved = resolveInlineTimes(item)
    publishTime = resolved.publishTime
    updatedTime = resolved.updatedTime
  }

  const entry = {
    id: item.id,
    title: item.title,
    file: item.file,
    content: item.content,
    publishTime,
    priority: item.priority === 'important' ? 'important' : 'normal',
  }

  // Only include updatedTime if it differs from publishTime (avoids noise)
  if (updatedTime && updatedTime !== publishTime) {
    entry.updatedTime = updatedTime
  }

  generated.push(entry)
}

// Sort: important first, then by publishTime desc
generated.sort((a, b) => {
  const aImp = a.priority === 'important' ? 0 : 1
  const bImp = b.priority === 'important' ? 0 : 1
  if (aImp !== bImp) return aImp - bImp
  return new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime()
})

writeFileSync(generatedPath, JSON.stringify(generated, null, 2) + '\n')

console.log(`\nWrote ${generated.length} announcement(s) to index.generated.json`)
console.log(`Done: ${errors} error(s), ${warnings} warning(s)\n`)

if (errors > 0) {
  console.error('\x1b[31mGENERATION FAILED\x1b[0m — fix errors above before building.\n')
  process.exit(1)
} else {
  console.log('\x1b[32mGENERATION COMPLETE\x1b[0m\n')
  process.exit(0)
}
