import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  fetchAkedataManifest,
  hashMaps,
  MAPS_LOCALES,
  materializeImageDb,
  materializeTableCfg,
  resolveImageDbRevision,
  sanitizeVersionId,
  selectAkedataVersion,
  type AkedataManifest,
  type FetchText,
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

const DEFAULT_CACHE_ROOT = join(projectRoot(), 'scripts', '.cache')

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
  /** Injectable for tests; defaults to the real HTTP downloader. */
  fetchText?: FetchText
  /** Override the materialization cache root (tests use a temp dir). */
  cacheRoot?: string
}

/**
 * A run is "local" when --local was passed *or* when no remote metadata was
 * produced (explicit checkout / config path). The version gate must skip both,
 * otherwise a local checkout without --local reports "up to date" and exits
 * before regenerating anything.
 */
export function isLocalSource(source: UpstreamSource, local: boolean): boolean {
  return local || source.remote === null
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

  const cacheRoot = options.cacheRoot ?? DEFAULT_CACHE_ROOT
  const manifest: AkedataManifest = await fetchAkedataManifest({
    cachePath: join(cacheRoot, 'akedata', 'manifest.json'),
    fetchText: options.fetchText,
  })
  const pinned = process.env['AKEDATA_VERSION'] || config.version || null
  const version = selectAkedataVersion(manifest, pinned)
  console.log(`  [upstream] data.akedata.wiki ${version.id} (published ${version.publishedAt})`)

  const versionRoot = join(cacheRoot, 'akedata', sanitizeVersionId(version.id))
  const tables = await materializeTableCfg({
    version,
    destRoot: versionRoot,
    mode: options.mode,
    fetchText: options.fetchText,
  })
  console.log(
    `  [upstream] TableCfg: ${tables.downloaded.length} downloaded, ${tables.skipped} cached`,
  )

  // An explicit --imagedb / config path wins over the cache: callers use it to
  // test local attribute maps without cloning AKEData as well.
  const explicitMaps = cliArgs['imagedb'] || cliArgs['i'] || config.imagedb
  if (explicitMaps) {
    const missing = MAPS_LOCALES.filter((locale) => !existsSync(join(explicitMaps, 'public', locale, 'maps.json')))
    if (missing.length > 0) {
      throw new Error(`--imagedb "${explicitMaps}" is missing maps.json for: ${missing.join(', ')}`)
    }
    const mapsHash = hashMaps(explicitMaps)
    console.log(`  [upstream] AKEDatabase maps: local ${explicitMaps} (${mapsHash})`)
    return {
      paths: { akedata: versionRoot, imagedb: explicitMaps },
      remote: { version: version.id, publishedAt: version.publishedAt, mapsHash },
    }
  }

  // Pin the AKEDatabase revision once so the four locale files cannot come from
  // different commits while main advances mid-download. maps.json is tiny, so
  // it is always refetched to keep mapsHash honest.
  const revision = resolveImageDbRevision()
  const imageDb = await materializeImageDb({
    destRoot: join(cacheRoot, 'akedatabase'),
    revision,
    skipExisting: false,
    fetchText: options.fetchText,
  })
  console.log(
    `  [upstream] AKEDatabase maps @${revision.slice(0, 7)}: ${imageDb.downloaded.length > 0 ? 'refreshed' : 'cached'} (${imageDb.mapsHash})`,
  )

  return {
    paths: { akedata: versionRoot, imagedb: imageDb.dir },
    remote: { version: version.id, publishedAt: version.publishedAt, mapsHash: imageDb.mapsHash },
  }
}

