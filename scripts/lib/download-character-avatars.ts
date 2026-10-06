import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, type Browser, type Page } from '@playwright/test'
import sharp from 'sharp'
import {
  buildCharacterImageTargets,
  collectIllustrationUrls,
  getCatalogItems,
  getIllustrationUrl,
  type CharacterImageTarget,
} from './skland-character-images'
import { fetchRemoteWithRetry, runPool } from './wiki-builder-utils'

const CATALOG_URL =
  'https://wiki.skland.com/endfield/catalog?mainTypeId=1&subTypeId=1&filterIds=&header=0'
const ADMINISTRATOR_ID = 'chr_9000_endmin'
const DEPRECATED_IDS: Record<string, true> = {
  chr_0002_endminm: true,
  chr_0003_endminf: true,
}
const AVIF_OPTIONS = { quality: 60, chromaSubsampling: '4:4:4', effort: 4 } as const

interface ImageJob {
  id: string
  kind: 'avatar' | 'fullBody'
  remoteUrl?: string
}

interface ImageSourceRecord {
  source: 'skland'
  url: string
  /**
   * sha256 (hex) of the downloaded source PNG bytes. Lets a re-sync skip
   * re-encoding when the source is unchanged, so re-running on a different
   * encoder/platform does not churn the git diff for unchanged artwork.
   */
  hash?: string
}

/**
 * Images the run is required to produce. Callers pass the freshly generated Wiki
 * asset manifest so the scrape fails for exactly the files the prebuild image gate
 * (scripts/check-images.mjs) rejects — not for a list this module invents.
 */
export interface CharacterImageExpectation {
  /** Avatar asset ids required in `images/characters/`. */
  avatarIds: readonly string[]
  /** Full-body asset ids required in `images/characters/full/`. */
  fullBodyIds: readonly string[]
}

/** Administrator variants are part of every scraped avatar set. */
const ADMINISTRATOR_ASSET_IDS = ['chr_9000_endmin-male', 'chr_9000_endmin-female'] as const

/** Fallback expectation for standalone runs (no asset manifest on hand). */
function releasedExpectation(
  releasedNameToId: Readonly<Record<string, string>>
): CharacterImageExpectation {
  const ids = [...Object.values(releasedNameToId), ...ADMINISTRATOR_ASSET_IDS]
  return { avatarIds: ids, fullBodyIds: ids }
}

function expectedImageKeys(expectation: CharacterImageExpectation): string[] {
  return [
    ...[...new Set(expectation.avatarIds)].map((id) => `avatar/${id}`),
    ...[...new Set(expectation.fullBodyIds)].map((id) => `fullBody/${id}`),
  ]
}

/** `avatar/<id>` / `fullBody/<id>` → committed avif path. */
function imagePathFor(avatarDir: string, key: string): string {
  const [kind, id] = key.split('/')
  return kind === 'fullBody' ? join(avatarDir, 'full', `${id}.avif`) : join(avatarDir, `${id}.avif`)
}

function collectMissing(keys: readonly string[], has: (key: string) => boolean): string[] {
  return keys.filter((key) => !has(key)).sort()
}

export interface CharacterImageDownloadResult {
  avatars: number
  fullBody: number
  /**
   * Number of preview characters (not yet in game data) whose avatar was
   * downloaded under a `preview-<itemId>` asset ID. Their name -> asset ID
   * mapping is written to src/generated/data/wiki/preview-character-avatars.json
   * so the frontend can resolve avatars without hardcoding.
   */
  previews: number
  /**
   * Required image keys (`avatar/<id>` / `fullBody/<id>`) the run did not produce.
   * A skipped scrape reports what the committed directory is still missing, so
   * "keep the previous files" can never quietly ship a character whose avatar CI
   * then rejects.
   */
  missing: string[]
  /**
   * Scrape was skipped — browser unavailable, network failed, or Skland response
   * lacked expected image URLs. Existing `images/characters` is left untouched so
   * prior sync output remains valid; callers should mark the PR accordingly.
   * A partial scrape is never committed — on the first failure we bail out of
   * the whole step rather than ship an incomplete character set.
   */
  skipped: boolean
  skipReason?: string
}

function loadReleasedNameMap(projectRoot: string): Record<string, string> {
  const path = join(projectRoot, 'src', 'generated', 'i18n', 'characters', 'zh-CN.json')
  const names = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>
  return Object.fromEntries(
    Object.entries(names)
      .filter(
        ([id, name]) =>
          id.startsWith('chr_') &&
          !DEPRECATED_IDS[id] &&
          id !== ADMINISTRATOR_ID &&
          name !== id
      )
      .map(([id, name]) => [name, id])
  )
}


/**
 * Skland's wiki API requires a per-request `timestamp` + `sign` header that only
 * the page's own JS can produce, so payloads are captured from the page's own
 * (signed) responses instead of calling the API directly (which returns HTTP 401).
 */
async function fetchSklandCatalogPayload(page: Page): Promise<unknown> {
  let catalogPayload: unknown
  const responsePromise = page.waitForResponse(
    async (response) => {
      if (
        response.request().method() !== 'GET' ||
        !response.url().includes('/web/v1/wiki/item/catalog?typeMainId=1&typeSubId=1')
      ) return false
      try {
        const payload: unknown = await response.json()
        getCatalogItems(payload)
        catalogPayload = payload
        return true
      } catch {
        return false
      }
    },
    { timeout: 30_000 }
  )
  await page.goto(CATALOG_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await responsePromise
  return catalogPayload
}

async function collectSklandTargets(
  page: Page,
  releasedNameToId: Readonly<Record<string, string>>
): Promise<{ targets: CharacterImageTarget[]; illustrations: Record<string, string> }> {
  const catalogPayload = await fetchSklandCatalogPayload(page)
  const targets = buildCharacterImageTargets(
    getCatalogItems(catalogPayload),
    releasedNameToId
  )
  const illustrations = await collectIllustrationUrls(targets, async (itemId) => {
    // Skland's wiki API now requires a per-request `timestamp` + `sign` header
    // that only the page's own JS can produce. Navigate to the detail route and
    // capture the page's own signed item/info response instead of calling the
    // API directly (which returns HTTP 401).
    const detailUrl = `https://wiki.skland.com/endfield/detail?mainTypeId=1&subTypeId=1&gameEntryId=${encodeURIComponent(itemId)}&header=0`
    const infoPromise = page.waitForResponse(
      async (response) => {
        if (
          response.request().method() !== 'GET' ||
          !response.url().includes(`/web/v1/wiki/item/info?id=${itemId}`)
        ) return false
        try {
          getIllustrationUrl(await response.json())
          return true
        } catch {
          return false
        }
      },
      { timeout: 30_000 }
    )
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    return (await infoPromise).json()
  })
  return { targets, illustrations }
}


async function fetchRemote(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}


export function serializeImageSources(
  sources: Readonly<Record<string, ImageSourceRecord>>
): string {
  const sorted = Object.fromEntries(
    Object.entries(sources).sort(([left], [right]) => left.localeCompare(right))
  )
  return `${JSON.stringify(sorted, null, 2)}\n`
}

function sourceSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Load the previously committed sources.json so a re-sync can tell which
 * sources are unchanged and keep the existing avif bytes instead of re-encoding.
 */
function loadExistingSources(avatarDir: string): Record<string, ImageSourceRecord> {
  const path = join(avatarDir, 'sources.json')
  if (!existsSync(path)) return {}
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, ImageSourceRecord>
    return parsed ?? {}
  } catch {
    return {}
  }
}

/** Generated name -> `preview-<itemId>` manifest, written by every scrape. */
function previewManifestPath(projectRoot: string): string {
  return join(projectRoot, 'src', 'generated', 'data', 'wiki', 'preview-character-avatars.json')
}

function loadPreviewManifest(projectRoot: string): Record<string, string> {
  const path = previewManifestPath(projectRoot)
  if (!existsSync(path)) return {}
  try {
    return (JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>) ?? {}
  } catch {
    return {}
  }
}

export async function downloadCharacterAvatars(
  outputDir = 'public',
  launchBrowser: () => Promise<Browser> = () => chromium.launch({ headless: true }),
  expectation?: CharacterImageExpectation,
): Promise<CharacterImageDownloadResult> {
  const projectRoot = outputDir === 'public' ? process.cwd() : resolve(outputDir, '..')
  const releasedNameToId = loadReleasedNameMap(projectRoot)
  const avatarDir = join(outputDir, 'images', 'characters')
  const expectedKeys = expectedImageKeys(expectation ?? releasedExpectation(releasedNameToId))
  const missingIn = (dir: string) =>
    collectMissing(expectedKeys, (key) => existsSync(imagePathFor(dir, key)))
  const tempDir = join(dirname(avatarDir), `.characters-${process.pid}-${Date.now()}`)
  const tempFullDir = join(tempDir, 'full')
  mkdirSync(tempFullDir, { recursive: true })

  let scrapedTargets: CharacterImageTarget[] = []
  let illustrations: Record<string, string> = {}

  let browser: Browser | undefined
  try {
    browser = await launchBrowser()
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    const scraped = await collectSklandTargets(page, releasedNameToId)
    scrapedTargets = scraped.targets
    illustrations = scraped.illustrations
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true })
    return skippedResult(`Skland character scrape failed: ${String(error)}`, missingIn(avatarDir))
  } finally {
    if (browser) await browser.close()
  }

  const jobs: ImageJob[] = []
  const sources: Record<string, ImageSourceRecord> = {}
  for (const target of scrapedTargets) {
    if (target.avatarId) {
      if (!target.avatarUrl) {
        // Preview entries missing an avatar URL are dropped individually so a
        // half-finished Skland wiki page cannot abort the whole scrape.
        if (target.isPreview) continue
        rmSync(tempDir, { recursive: true, force: true })
        return skippedResult(`Missing Skland image URL for avatar/${target.avatarId}`, missingIn(avatarDir))
      }
      jobs.push({
        id: target.avatarId,
        kind: 'avatar',
        remoteUrl: target.avatarUrl,
      })
    }
    if (target.fullBodyId) {
      const remoteUrl = illustrations[target.fullBodyId]
      if (!remoteUrl) {
        // Same leniency for preview entries: avatar-only is still useful.
        if (target.isPreview) continue
        rmSync(tempDir, { recursive: true, force: true })
        return skippedResult(`Missing Skland image URL for fullBody/${target.fullBodyId}`, missingIn(avatarDir))
      }
      jobs.push({
        id: target.fullBodyId,
        kind: 'fullBody',
        remoteUrl,
      })
    }
  }

  const existingSources = loadExistingSources(avatarDir)
  try {
    await runPool(jobs, 6, async (job) => {
      if (!job.remoteUrl) {
        throw new Error(`Missing Skland image URL for ${job.kind}/${job.id}`)
      }
      const buffer = await fetchRemoteWithRetry(job.remoteUrl, fetchRemote)
      const key = `${job.kind}/${job.id}`
      const hash = sourceSha256(buffer)
      const destination = join(
        job.kind === 'avatar' ? tempDir : tempFullDir,
        `${job.id}.avif`
      )
      const committedFile = join(
        job.kind === 'avatar' ? avatarDir : join(avatarDir, 'full'),
        `${job.id}.avif`
      )
      if (existingSources[key]?.hash === hash && existsSync(committedFile)) {
        // Source PNG is unchanged from the last sync: reuse the committed avif
        // bytes instead of re-encoding, so a re-sync on a different
        // encoder/platform does not churn the git diff for unchanged artwork.
        copyFileSync(committedFile, destination)
      } else {
        await sharp(buffer).avif(AVIF_OPTIONS).toFile(destination)
      }
      sources[key] = { source: 'skland', url: job.remoteUrl, hash }
    })

    writeFileSync(join(tempDir, 'sources.json'), serializeImageSources(sources), 'utf8')
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true })
    return skippedResult(`Skland character download failed: ${String(error)}`, missingIn(avatarDir))
  }

  rmSync(avatarDir, { recursive: true, force: true })
  renameSync(tempDir, avatarDir)

  // The committed directory was just replaced wholesale, so anything still absent
  // here is exactly what the prebuild image gate will reject.
  const missing = missingIn(avatarDir)

  // Emit name -> asset ID for preview characters (not yet in game data) so
  // the frontend can resolve their avatars without hardcoding. Once a
  // character ships, the released mapping wins and the entry disappears.
  const previewAvatars: Record<string, string> = {}
  for (const target of scrapedTargets) {
    if (
      target.isPreview &&
      target.avatarId &&
      existsSync(join(avatarDir, `${target.avatarId}.avif`))
    ) {
      previewAvatars[target.name] = target.avatarId
    }
  }
  const manifestPath = previewManifestPath(projectRoot)
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(manifestPath, `${JSON.stringify(previewAvatars, null, 2)}\n`, 'utf8')
  return {
    avatars: jobs.filter((job) => job.kind === 'avatar').length,
    fullBody: jobs.filter((job) => job.kind === 'fullBody').length,
    previews: Object.keys(previewAvatars).length,
    skipped: false,
    missing,
  }
}

// ── Skland preview drift probe (check phase) ──────────────────────────────

export interface SklandPreviewDriftEntry {
  name: string
  assetId: string
}

/**
 * Skland-side drift the upstream SHA gates cannot see: the wiki is neither in
 * AKEData nor in AKEDatabase, so a new preview character (or a replaced avatar)
 * never makes a plain `--check` report a change. Callers treat a probe failure as
 * "unknown", never as "changed".
 */
export interface SklandPreviewDrift {
  /** Preview characters on the wiki whose avatar is absent from the committed manifest. */
  unscraped: SklandPreviewDriftEntry[]
  /** Committed preview avatars whose Skland source URL changed since the last scrape. */
  changedAvatars: SklandPreviewDriftEntry[]
  /** Probe could not run (browser unavailable, network error, wiki layout change). */
  probeError?: string
}

/**
 * Compares the live Skland operator catalog against the committed preview avatars.
 * Only the catalog page is fetched (a single navigation) — the avatar cover URL is
 * part of that payload — so a new preview character is detected in ~15s instead of
 * the minutes a full character scrape costs.
 */
export async function probeSklandPreviewDrift(
  outputDir = 'public',
  launchBrowser: () => Promise<Browser> = () => chromium.launch({ headless: true })
): Promise<SklandPreviewDrift> {
  const projectRoot = outputDir === 'public' ? process.cwd() : resolve(outputDir, '..')
  const manifest = loadPreviewManifest(projectRoot)
  const sources = loadExistingSources(join(outputDir, 'images', 'characters'))
  const releasedNameToId = loadReleasedNameMap(projectRoot)

  let browser: Browser | undefined
  try {
    browser = await launchBrowser()
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    const targets = buildCharacterImageTargets(
      getCatalogItems(await fetchSklandCatalogPayload(page)),
      releasedNameToId
    )

    const unscraped: SklandPreviewDriftEntry[] = []
    const changedAvatars: SklandPreviewDriftEntry[] = []
    for (const target of targets) {
      if (!target.isPreview || !target.avatarId) continue
      const entry = { name: target.name, assetId: target.avatarId }
      if (manifest[target.name] !== target.avatarId) {
        // Released characters resolve through the i18n name map instead, so only
        // entries that are still previews can land here.
        unscraped.push(entry)
        continue
      }
      const recorded = sources[`avatar/${target.avatarId}`]?.url
      if (recorded && target.avatarUrl && recorded !== target.avatarUrl) {
        changedAvatars.push(entry)
      }
    }
    return { unscraped, changedAvatars }
  } catch (error) {
    return { unscraped: [], changedAvatars: [], probeError: String(error) }
  } finally {
    if (browser) await browser.close()
  }
}

function skippedResult(skipReason: string, missing: string[]): CharacterImageDownloadResult {
  return { avatars: 0, fullBody: 0, previews: 0, skipped: true, skipReason, missing }
}

const isCli = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false

if (isCli) {
  downloadCharacterAvatars(process.argv[2] ?? 'public').then(
    (result) => console.log(`[characters] ${JSON.stringify(result)}`),
    (error: unknown) => {
      console.error(error)
      process.exitCode = 1
    }
  )
}
