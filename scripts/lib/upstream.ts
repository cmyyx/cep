import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  fetchAkedataManifest,
  materializeImageDb,
  materializeTableCfg,
  sanitizeVersionId,
  selectAkedataVersion,
  type AkedataManifest,
} from './akedata-remote'

export interface UpstreamPaths {
  akedata: string
  imagedb: string
}

/** Metadata recorded for the site's data-version display and the change gate. */
export interface RemoteUpstream {
  /** Published version id, e.g. 1.6.4@11944529-13. */
  version: string
  publishedAt: string
  /** Content hash of the four maps.json files. */
  mapsHash: string
}

export interface UpstreamSource {
  paths: UpstreamPaths
  /** null in local mode (no manifest involved). */
  remote: RemoteUpstream | null
}

interface SyncConfig {
  akedata: string
  imagedb: string
  version: string
}

const CACHE_ROOT = join(projectRoot(), 'scripts', '.cache')
const MANIFEST_CACHE = join(CACHE_ROOT, 'akedata', 'manifest.json')

function projectRoot(): string {
  try {
    return join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  } catch {
    return process.cwd()
  }
}

function readConfig(): SyncConfig {
  const configPath = join(projectRoot(), 'sync-game-data.config.json')
  try {
    if (existsSync(configPath)) {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
      return {
        akedata: typeof raw.akedata === 'string' ? raw.akedata : typeof raw.akedataPath === 'string' ? raw.akedataPath : '',
        imagedb: typeof raw.imagedb === 'string' ? raw.imagedb : typeof raw.imagedbPath === 'string' ? raw.imagedbPath : '',
        version: typeof raw.akedataVersion === 'string' ? raw.akedataVersion : '',
      }
    }
  } catch { /* ignore */ }
  return { akedata: '', imagedb: '', version: '' }
}

/** Resolve local upstream paths from CLI args, config file, or defaults. */
export function resolvePaths(cliArgs: Record<string, string>): UpstreamPaths {
  const fromCli = {
    akedata: cliArgs['akedata'] ?? cliArgs['a'] ?? '',
    imagedb: cliArgs['imagedb'] ?? cliArgs['i'] ?? '',
  }
  const fromConfig = readConfig()
  return {
    akedata: fromCli.akedata || fromConfig.akedata || join(projectRoot(), '..', 'upstream', 'AKEData'),
    imagedb: fromCli.imagedb || fromConfig.imagedb || join(projectRoot(), '..', 'upstream', 'AKEDatabase'),
  }
}

export function validatePaths(paths: UpstreamPaths): string[] {
  const warnings: string[] = []
  if (!existsSync(paths.akedata)) {
    warnings.push(`AKEData: path not found - "${paths.akedata}"`)
  } else if (!existsSync(join(paths.akedata, 'TableCfg'))) {
    warnings.push('AKEData: missing expected subdirectory "TableCfg"')
  }
  if (paths.imagedb && !existsSync(paths.imagedb)) warnings.push(`AKEDatabase: path not found — "${paths.imagedb}"`)
  return warnings
}

export interface ResolveSourceOptions {
  mode: 'check' | 'update'
  local: boolean
}

/**
 * Resolve the upstream data tree.
 *
 * Local mode (--local, or any explicit --akedata / config path) keeps using a
 * checkout on disk. Otherwise the tree is materialized from
 * https://data.akedata.wiki into scripts/.cache/akedata/<version>/ and reused
 * for every later run of the same version.
 */
export async function resolveUpstreamSource(
  cliArgs: Record<string, string>,
  options: ResolveSourceOptions,
): Promise<UpstreamSource> {
  const config = readConfig()
  const explicitLocal = Boolean(cliArgs['akedata'] || cliArgs['a'] || config.akedata)
  if (options.local || explicitLocal) {
    const paths = resolvePaths(cliArgs)
    if (!existsSync(join(paths.akedata, 'TableCfg'))) {
      throw new Error(
        `Local AKEData checkout not found at "${paths.akedata}" (expected TableCfg/). ` +
        'Drop --local / --akedata to materialize the data from data.akedata.wiki instead.',
      )
    }
    console.log(`  [upstream] local AKEData: ${paths.akedata}`)
    return { paths, remote: null }
  }

  const manifest: AkedataManifest = await fetchAkedataManifest({ cachePath: MANIFEST_CACHE })
  const pinned = process.env['AKEDATA_VERSION'] || config.version || null
  const version = selectAkedataVersion(manifest, pinned)
  console.log(`  [upstream] data.akedata.wiki ${version.id} (published ${version.publishedAt})`)

  const versionRoot = join(CACHE_ROOT, 'akedata', sanitizeVersionId(version.id))
  const tables = await materializeTableCfg({ version, destRoot: versionRoot, mode: options.mode })
  console.log(
    `  [upstream] TableCfg: ${tables.downloaded.length} downloaded, ${tables.skipped} cached`,
  )

  // maps.json is tiny (4 x ~13KB): always refetch so mapsHash tracks upstream
  // changes instead of pinning the first copy forever.
  const imageDb = await materializeImageDb({ destRoot: join(CACHE_ROOT, 'akedatabase'), skipExisting: false })
  console.log(
    `  [upstream] AKEDatabase maps: ${imageDb.downloaded.length > 0 ? 'refreshed' : 'cached'} (${imageDb.mapsHash})`,
  )

  return {
    paths: { akedata: versionRoot, imagedb: imageDb.dir },
    remote: { version: version.id, publishedAt: version.publishedAt, mapsHash: imageDb.mapsHash },
  }
}

