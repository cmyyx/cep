// Remote AKEData source (https://data.akedata.wiki).
// ================================================================================
// The upstream repository is no longer cloned: the data host publishes
//   manifest.json                     → { latest, versions[] }
//   <tableCfgPath>/<Table>.json       → full client tables per version
// Every hotfix gets a new immutable version directory, so a downloaded tree can
// be cached forever once its version id is recorded.
//
// int64 note: tables are stored byte-for-byte, and the sync pipeline parses them
// with parseJsonSafe (lossless-json). Never JSON.parse a table just to inspect it.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { GAME_I18N_LOCALES, GAME_I18N_UPSTREAM_SUFFIX } from '../../src/lib/game-i18n-shared'

/** Data host for game tables and Wiki UI assets. */
export const AKE_DATA_CDN = 'https://data.akedata.wiki'

/** Attribute maps used by the Wiki (ATTR_MAP / ATTR_MAP_EN). */
export const AKEDATABASE_RAW_BASE = 'https://raw.githubusercontent.com/NagiYume/AKEDatabase'

/** Locale directories that carry maps.json inside AKEDatabase. */
export const MAPS_LOCALES = ['CH', 'EN', 'JP', 'TC'] as const

/**
 * Every TableCfg file the sync pipeline reads.
 * Keep in sync with the table loaders in scripts/lib — a missing file fails
 * loudly during materialization instead of surfacing as an empty table.
 */
export const SYNC_TABLES = [
  'AttributeMetaTable',
  'AttributeShowConfigTable',
  'BattleConst',
  'CharGrowthTable',
  'CharLevelUpTable',
  'CharProfessionTable',
  'CharTypeTable',
  'CharWpnRecommendTable',
  'CharacterConst',
  'CharacterPotentialTable',
  'CharacterTable',
  'CompositeAttributeShowConfigTable',
  'DungeonSeriesTable',
  'DungeonTable',
  'EquipFormulaChainTable',
  'EquipFormulaReverseTable',
  'EquipFormulaTable',
  'EquipSuitTable',
  'EquipTable',
  'ExpItemDataMap',
  'ForesightWeaponGemwishlistTable',
  'ForesightWeaponTable',
  'GachaCharPoolContentTable',
  'GachaCharPoolTable',
  'GachaWeaponPoolContentTable',
  'GachaWeaponPoolTable',
  'GemTable',
  'HyperlinkTextTable',
  'ItemTable',
  'PotentialTalentEffectTable',
  'RewardTable',
  'ShopGoodsTable',
  'ShopGroupTable',
  'ShopTable',
  'SkillPatchTable',
  'SpaceshipCharSkillTable',
  'SpaceshipSkillTable',
  'SystemJumpTable',
  'TextTable',
  'TimeRangeTable',
  'UsableItemChestTable',
  'WeaponBasicTable',
  'WeaponBreakThroughTemplateTable',
  'WeaponExpItemTable',
  'WeaponUpgradeTemplateTable',
  'WorldEnergyPointGroupTable',
  'WorldEnergyPointTable',
] as const

/** Upstream I18nTextTable filename suffix per export locale (CN/EN/JP/…). */
export const GAME_I18N_SUFFIXES: readonly string[] = GAME_I18N_LOCALES.map(
  (locale) => GAME_I18N_UPSTREAM_SUFFIX[locale],
)

export interface AkedataVersion {
  id: string
  gameVersion: string
  hotfixVersion: string
  /** Directory that holds TableCfg for this version, e.g. public/1.6.4/11944529-13/TableCfg. */
  tableCfgPath: string
  publishedAt: string
}

export interface AkedataManifest {
  schemaVersion: number
  latest: string
  versions: AkedataVersion[]
}

export type FetchText = (url: string) => Promise<string>

/**
 * Download a URL as text with one retry.
 *
 * Redirects are rejected (`redirect: 'manual'`): every host we pull from serves
 * the bytes directly, and following a redirect would let a compromised upstream
 * point the sync runner at an internal address.
 */
export async function defaultFetchText(url: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: 'manual' })
      if (response.status >= 300 && response.status < 400) {
        throw new Error(`Redirect not allowed (HTTP ${response.status})`)
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`Failed to download ${url}: ${String(lastError)}`)
}

/**
 * Files above this size are only checked for a valid tail, because JSON.parse
 * materialises the whole document and six concurrent 34MB text tables would
 * spike memory on the runner (and on phones).
 */
const MAX_FULL_JSON_VALIDATION_BYTES = 8 * 1024 * 1024
const JSON_TAIL_BYTES = 64

function isSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d
}

/**
 * Reject truncated or non-JSON bodies before they become an immutable cache
 * entry. A body that merely starts with "{" is not enough: a truncated
 * `{"entry":` would be cached and fail every later run until the version
 * directory changes.
 */
function assertJsonBody(text: string, url: string): void {
  let start = 0
  let end = text.length - 1
  while (start <= end && isSpace(text.charCodeAt(start))) start += 1
  while (end >= start && isSpace(text.charCodeAt(end))) end -= 1
  const head = text[start]
  const tail = text[end]
  if ((head !== '{' && head !== '[') || (tail !== '}' && tail !== ']')) {
    throw new Error(`Unexpected response (invalid or truncated JSON) for ${url}`)
  }
  if (Buffer.byteLength(text, 'utf-8') > MAX_FULL_JSON_VALIDATION_BYTES) return
  try {
    JSON.parse(text)
  } catch {
    throw new Error(`Malformed JSON from ${url}`)
  }
}

/** Cheap integrity check for a cached table: non-empty and ends like JSON. */
function hasJsonTail(filePath: string): boolean {
  try {
    const { size } = statSync(filePath)
    if (size === 0) return false
    const length = Math.min(JSON_TAIL_BYTES, size)
    const fd = openSync(filePath, 'r')
    try {
      const buffer = Buffer.alloc(length)
      readSync(fd, buffer, 0, length, size - length)
      const tail = buffer.toString('utf-8').trimEnd()
      const last = tail[tail.length - 1]
      return last === '}' || last === ']'
    } finally {
      closeSync(fd)
    }
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

export function parseAkedataManifest(raw: unknown): AkedataManifest {
  if (!isRecord(raw)) throw new Error('AKEData manifest is not an object')
  const latest = readString(raw, 'latest')
  const versions = Array.isArray(raw.versions)
    ? raw.versions.filter(isRecord).map((entry) => ({
      id: readString(entry, 'id'),
      gameVersion: readString(entry, 'gameVersion'),
      hotfixVersion: readString(entry, 'hotfixVersion'),
      tableCfgPath: readString(entry, 'tableCfgPath'),
      publishedAt: readString(entry, 'publishedAt'),
    })).filter((entry) => entry.id && entry.tableCfgPath)
    : []
  if (!latest || !versions.some((entry) => entry.id === latest)) {
    throw new Error('AKEData manifest is missing a valid "latest" version')
  }
  return {
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
    latest,
    versions,
  }
}

/** Pick the pinned version when given, otherwise the manifest's latest. */
export function selectAkedataVersion(manifest: AkedataManifest, pinned?: string | null): AkedataVersion {
  const wanted = pinned || manifest.latest
  const version = manifest.versions.find((entry) => entry.id === wanted)
  if (!version) {
    throw new Error(`AKEData version "${wanted}" not found in manifest (latest: ${manifest.latest})`)
  }
  return version
}

/** Version ids contain "@" and "." only, but sanitize defensively for path use. */
export function sanitizeVersionId(id: string): string {
  return id.replace(/[^A-Za-z0-9._@-]/g, '_')
}

export function tableCfgUrl(baseUrl: string, version: AkedataVersion, fileName: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${version.tableCfgPath}/${fileName}.json`
}

export function mapsUrl(locale: string, revision = 'main'): string {
  return `${AKEDATABASE_RAW_BASE}/${revision}/public/${locale}/maps.json`
}

/**
 * Resolve the current AKEDatabase commit once per run so the four locale files
 * in one materialization all come from the same tree. Falls back to "main" when
 * git is unavailable (offline runs will fail later with a clearer error).
 */
export function resolveImageDbRevision(): string {
  try {
    const output = execFileSync(
      'git',
      ['ls-remote', 'https://github.com/NagiYume/AKEDatabase.git', 'refs/heads/main'],
      { encoding: 'utf-8', timeout: 30_000 },
    )
    const sha = output.trim().split(/\s+/)[0] ?? ''
    return /^[0-9a-f]{40}$/.test(sha) ? sha : 'main'
  } catch {
    return 'main'
  }
}

async function mapPool<T>(values: readonly T[], concurrency: number, worker: (value: T) => Promise<void>): Promise<void> {
  let cursor = 0
  let failure: unknown = null
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (!failure && cursor < values.length) {
        const value = values[cursor]
        cursor += 1
        try {
          await worker(value)
        } catch (error) {
          failure = error
        }
      }
    }),
  )
  if (failure) throw failure
}

async function downloadJsonFile(
  url: string,
  destPath: string,
  fetchText: FetchText,
  skipExisting: boolean,
): Promise<'skipped' | 'downloaded'> {
  // A cached file with a broken tail is re-downloaded instead of trusted, so a
  // truncated entry can heal itself on the next run.
  if (skipExisting && existsSync(destPath) && hasJsonTail(destPath)) return 'skipped'
  const text = await fetchText(url)
  assertJsonBody(text, url)
  mkdirSync(dirname(destPath), { recursive: true })
  // Per-process temp name: two syncs sharing a cache dir must not rename each
  // other's half-written file.
  const tempPath = `${destPath}.${process.pid}.tmp`
  writeFileSync(tempPath, text, 'utf-8')
  renameSync(tempPath, destPath)
  return 'downloaded'
}

export interface FetchManifestOptions {
  baseUrl?: string
  fetchText?: FetchText
  cachePath?: string
}

export async function fetchAkedataManifest(options: FetchManifestOptions = {}): Promise<AkedataManifest> {
  const baseUrl = options.baseUrl ?? AKE_DATA_CDN
  const fetchText = options.fetchText ?? defaultFetchText
  const url = `${baseUrl.replace(/\/$/, '')}/manifest.json`
  const text = await fetchText(url)
  const manifest = parseAkedataManifest(JSON.parse(text) as unknown)
  if (options.cachePath) {
    mkdirSync(dirname(options.cachePath), { recursive: true })
    writeFileSync(options.cachePath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
  }
  return manifest
}

/** Read the last manifest saved by a successful remote resolve. */
export function readCachedManifest(cachePath: string): AkedataManifest | null {
  try {
    if (!existsSync(cachePath)) return null
    return parseAkedataManifest(JSON.parse(readFileSync(cachePath, 'utf-8')) as unknown)
  } catch {
    return null
  }
}

export interface MaterializeOptions {
  version: AkedataVersion
  destRoot: string
  mode: 'check' | 'update'
  baseUrl?: string
  fetchText?: FetchText
  skipExisting?: boolean
  concurrency?: number
}

export interface MaterializeResult {
  tableCfgDir: string
  downloaded: string[]
  skipped: number
}

/**
 * Materialize the tables this run needs under <destRoot>/TableCfg.
 * check mode only needs zh-CN text; update mode needs every exported locale.
 */
export async function materializeTableCfg(options: MaterializeOptions): Promise<MaterializeResult> {
  const baseUrl = options.baseUrl ?? AKE_DATA_CDN
  const fetchText = options.fetchText ?? defaultFetchText
  const skipExisting = options.skipExisting ?? true
  const tableCfgDir = join(options.destRoot, 'TableCfg')
  mkdirSync(tableCfgDir, { recursive: true })

  const files = [
    ...SYNC_TABLES.map((table) => `${table}.json`),
    ...(options.mode === 'update'
      ? GAME_I18N_SUFFIXES.map((suffix) => `I18nTextTable_${suffix}.json`)
      : ['I18nTextTable_CN.json']),
  ]

  const downloaded: string[] = []
  let skipped = 0
  await mapPool(files, options.concurrency ?? 6, async (fileName) => {
    const url = tableCfgUrl(baseUrl, options.version, fileName.replace(/\.json$/, ''))
    const outcome = await downloadJsonFile(url, join(tableCfgDir, fileName), fetchText, skipExisting)
    if (outcome === 'skipped') skipped += 1
    else downloaded.push(fileName)
  })
  return { tableCfgDir, downloaded, skipped }
}

export interface ImageDbResult {
  /** Root that contains public/<CH|EN|JP|TC>/maps.json. */
  dir: string
  /** Content hash of the four maps.json files; the upstream-changed gate uses it. */
  mapsHash: string
  downloaded: string[]
  skipped: number
}

export async function materializeImageDb(options: {
  destRoot: string
  /** Immutable AKEDatabase revision; defaults to main. */
  revision?: string
  fetchText?: FetchText
  skipExisting?: boolean
}): Promise<ImageDbResult> {
  const fetchText = options.fetchText ?? defaultFetchText
  const skipExisting = options.skipExisting ?? true
  const revision = options.revision ?? 'main'
  const downloaded: string[] = []
  let skipped = 0
  await mapPool(MAPS_LOCALES, 4, async (locale) => {
    const destPath = join(options.destRoot, 'public', locale, 'maps.json')
    const outcome = await downloadJsonFile(mapsUrl(locale, revision), destPath, fetchText, skipExisting)
    if (outcome === 'skipped') skipped += 1
    else downloaded.push(locale)
  })
  return {
    dir: options.destRoot,
    mapsHash: hashMaps(options.destRoot),
    downloaded,
    skipped,
  }
}

/** Stable hash over the four maps.json files (order fixed by MAPS_LOCALES). */
export function hashMaps(imagedbRoot: string): string {
  const hash = createHash('sha256')
  for (const locale of MAPS_LOCALES) {
    hash.update(locale).update('\0')
    hash.update(readFileSync(join(imagedbRoot, 'public', locale, 'maps.json')))
    hash.update('\0')
  }
  return `maps-${hash.digest('hex').slice(0, 12)}`
}
