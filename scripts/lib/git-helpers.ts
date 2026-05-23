// Git operations for SHA tracking branch.
// ================================================================================

import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// ── Constants ─────────────────────────────────────────────────────────────────

const TRACKING_BRANCH = 'auto/upstream-tracking'
const AKEDATA_SHA_FILE = '.akadata-sha'
const TRANS_SHA_FILE = '.endfieldtranslation-sha'

// ── Reading ───────────────────────────────────────────────────────────────────

/** Read stored SHA from the tracking branch for the given file. */
export function readStoredSha(file: string): string | null {
  try {
    return execFileSync(
      'git', ['show', `${TRACKING_BRANCH}:${file}`],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
    ).trim()
  } catch {
    return null
  }
}

/** Fetch the tracking branch from origin (may not exist yet). */
export function fetchTrackingBranch(): void {
  try {
    execFileSync('git', ['fetch', 'origin', TRACKING_BRANCH], { stdio: 'ignore' })
  } catch {
    // Branch doesn't exist yet — that's OK
  }
}

// ── Writing ───────────────────────────────────────────────────────────────────

/** Write new SHA values and force-push to tracking branch. */
export function updateTrackingBranch(shas: { akedata: string; translation: string }): void {
  const tmpDir = join(process.cwd(), '.tmp-tracking')
  mkdirSync(tmpDir, { recursive: true })

  try {
    // Create orphan branch in temp dir
    execFileSync('git', ['init', tmpDir], { stdio: 'ignore' })

    writeFileSync(join(tmpDir, AKEDATA_SHA_FILE), shas.akedata + '\n', 'utf-8')
    writeFileSync(join(tmpDir, TRANS_SHA_FILE), shas.translation + '\n', 'utf-8')

    const cwd = process.cwd()
    process.chdir(tmpDir)
    try {
      execFileSync('git', ['add', '.'], { stdio: 'ignore' })
      const commitMsg = `${new Date().toISOString().slice(0, 10)} — AKEData: ${shas.akedata.slice(0, 7)}`
      execFileSync(
        'git',
        ['-c', 'user.name=CEP Sync Bot', '-c', 'user.email=sync@cep.local', 'commit', '--allow-empty', '-m', commitMsg],
        { stdio: 'ignore' },
      )
      execFileSync('git', ['push', cwd, `HEAD:refs/heads/${TRACKING_BRANCH}`, '--force'], { stdio: 'inherit' })
    } finally {
      process.chdir(cwd)
    }
  } finally {
    // Cleanup
    if (existsSync(tmpDir)) {
      try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
}

/** Check if a branch exists on origin. */
export function branchExistsOnOrigin(branch: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', `origin/${branch}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
