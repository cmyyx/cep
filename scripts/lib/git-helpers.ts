// Upstream version tracking — file-based, no orphan branches, no submodules.
// ================================================================================
//
// File: scripts/.cache/upstream-versions.json
//
// schemaVersion 2 tracks the published data version instead of git SHAs:
//   { schemaVersion, akedataVersion, akedataPublishedAt, imagedbMapsHash, lastSync }
// The v1 payload (akedata / imagedb SHAs) is still readable; it simply does not
// match, so the first run after the switch performs one full sync.
// ================================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSIONS_FILE = 'scripts/.cache/upstream-versions.json'

function getProjectRoot(): string {
  try {
    return join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  } catch {
    return process.cwd()
  }
}

export interface UpstreamVersions {
  schemaVersion: number
  /** Legacy v1 AKEData commit SHA (kept so old builds still display something). */
  akedata: string | null
  /** Published AKEData version id, e.g. 1.6.4@11944529-13. */
  akedataVersion: string | null
  akedataPublishedAt: string | null
  /** Content hash of the four AKEDatabase maps.json files. */
  imagedbMapsHash: string | null
  lastSync: string | null
}

function emptyVersions(): UpstreamVersions {
  return {
    schemaVersion: 0,
    akedata: null,
    akedataVersion: null,
    akedataPublishedAt: null,
    imagedbMapsHash: null,
    lastSync: null,
  }
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === 'string' && value ? value : null
}

/** Read committed upstream version snapshot from the working tree. */
export function readUpstreamVersions(rootDir: string = getProjectRoot()): UpstreamVersions {
  const versPath = join(rootDir, VERSIONS_FILE)
  try {
    if (existsSync(versPath)) {
      const raw = JSON.parse(readFileSync(versPath, 'utf-8')) as Record<string, unknown>
      return {
        schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
        akedata: readString(raw, 'akedata'),
        akedataVersion: readString(raw, 'akedataVersion'),
        akedataPublishedAt: readString(raw, 'akedataPublishedAt'),
        imagedbMapsHash: readString(raw, 'imagedbMapsHash'),
        lastSync: readString(raw, 'lastSync'),
      }
    }
  } catch {
    // File missing or malformed — treat as no stored version (first run).
  }
  return emptyVersions()
}

/** Both the data version and the attribute-map content must match. */
export function upstreamVersionsMatch(
  stored: UpstreamVersions,
  current: { version: string; mapsHash: string },
): boolean {
  return Boolean(
    stored.akedataVersion &&
    stored.imagedbMapsHash &&
    stored.akedataVersion === current.version &&
    stored.imagedbMapsHash === current.mapsHash,
  )
}

/**
 * Write upstream version snapshot to the working tree.
 * The caller (sync:update) is responsible for committing this file along with
 * generated i18n / data changes.
 */
export function writeUpstreamVersions(
  snapshot: { version: string; publishedAt: string; mapsHash: string },
  rootDir: string = getProjectRoot(),
): void {
  const root = rootDir
  const cacheDir = join(root, 'scripts', '.cache')
  mkdirSync(cacheDir, { recursive: true })

  const versPath = join(cacheDir, 'upstream-versions.json')
  const payload: UpstreamVersions = {
    schemaVersion: 2,
    akedata: null,
    akedataVersion: snapshot.version,
    akedataPublishedAt: snapshot.publishedAt,
    imagedbMapsHash: snapshot.mapsHash,
    lastSync: new Date().toISOString(),
  }
  writeFileSync(versPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')
  console.log(`  [git-helpers] Wrote upstream versions → ${VERSIONS_FILE}`)
}
