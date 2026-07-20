// Upstream version tracking — file-based, no orphan branches, no submodules.
// ================================================================================
//
// Replaced the old `auto/upstream-tracking` orphan branch approach with a simple
// JSON file committed to the main branch.  This eliminates:
//   - orphan branch force-push race conditions
//   - .gitmodules / gitlink pollution (the old approach cloned upstream repos
//     inside the working tree which Git interpreted as submodule entries)
//
// File: scripts/.cache/upstream-versions.json
// ================================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Constants ─────────────────────────────────────────────────────────────────

const VERSIONS_FILE = 'scripts/.cache/upstream-versions.json'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProjectRoot(): string {
  try {
    return join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  } catch {
    return process.cwd()
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface UpstreamVersions {
  /** AKEData fork HEAD commit SHA at last successful sync */
  akedata: string | null
  /** AKEDatabase HEAD commit SHA at last successful sync */
  imagedb: string | null
  /** ISO-8601 timestamp of last successful sync */
  lastSync: string | null
}

/** Read committed upstream version snapshot from the working tree. */
export function readUpstreamVersions(): UpstreamVersions {
  const versPath = join(getProjectRoot(), VERSIONS_FILE)
  try {
    if (existsSync(versPath)) {
      const raw = JSON.parse(readFileSync(versPath, 'utf-8')) as Partial<UpstreamVersions>
      return {
        akedata: raw.akedata ?? null,
        imagedb: raw.imagedb ?? null,
        lastSync: raw.lastSync ?? null,
      }
    }
  } catch {
    // File missing or malformed — treat as no stored version (first run).
  }
  return { akedata: null, imagedb: null, lastSync: null }
}

export function upstreamVersionsMatch(
  stored: UpstreamVersions,
  current: { akedata: string; imagedb: string }
): boolean {
  return Boolean(
    stored.akedata &&
    stored.imagedb &&
    stored.akedata === current.akedata &&
    stored.imagedb === current.imagedb
  )
}

/**
 * Write upstream version snapshot to the working tree.
 * The caller (sync:update) is responsible for committing this file along with
 * generated i18n / data changes.
 */
export function writeUpstreamVersions(shas: { akedata: string; imagedb: string }): void {
  const root = getProjectRoot()
  const cacheDir = join(root, 'scripts', '.cache')
  mkdirSync(cacheDir, { recursive: true })

  const versPath = join(cacheDir, 'upstream-versions.json')
  const payload: UpstreamVersions = {
    akedata: shas.akedata,
    imagedb: shas.imagedb,
    lastSync: new Date().toISOString(),
  }
  writeFileSync(versPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')
  console.log(`  [git-helpers] Wrote upstream versions → ${VERSIONS_FILE}`)
}
