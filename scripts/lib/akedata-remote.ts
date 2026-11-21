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

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { GAME_I18N_LOCALES, GAME_I18N_UPSTREAM_SUFFIX } from '../../src/lib/game-i18n-shared'

/** Data host for game tables and Wiki UI assets. */
export const AKE_DATA_CDN = 'https://data.akedata.wiki'

/** Attribute maps used by the Wiki (ATTR_MAP / ATTR_MAP_EN). */
export const AKEDATABASE_RAW_BASE = 'https://raw.githubusercontent.com/NagiYume/AKEDatabase/main'

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

/** Download a URL as text with one retry; JSON bodies are validated cheaply. */
export async function defaultFetchText(url: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`Failed to download ${url}: ${String(lastError)}`)
}

function assertJsonBody(text: string, url: string): void {
  const head = text.trimStart()[0]
  if (head !== '{' && head !== '[') {
    throw new Error(`Unexpected response (not JSON) for ${url}`)
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

export function mapsUrl(locale: string): string {
  return `${AKEDATABASE_RAW_BASE}/public/${locale}/maps.json`
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
  if (skipExisting && existsSync(destPath)) return 'skipped'
  const text = await fetchText(url)
  assertJsonBody(text, url)
  mkdirSync(dirname(destPath), { recursive: true })
  const tempPath = `${destPath}.tmp`
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
  fetchText?: FetchText
  skipExisting?: boolean
}): Promise<ImageDbResult> {
  const fetchText = options.fetchText ?? defaultFetchText
  const skipExisting = options.skipExisting ?? true
  const downloaded: string[] = []
  let skipped = 0
  await mapPool(MAPS_LOCALES, 4, async (locale) => {
    const destPath = join(options.destRoot, 'public', locale, 'maps.json')
    const outcome = await downloadJsonFile(mapsUrl(locale), destPath, fetchText, skipExisting)
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
