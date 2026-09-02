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


async function collectSklandTargets(
  page: Page,
  releasedNameToId: Readonly<Record<string, string>>
): Promise<{ targets: CharacterImageTarget[]; illustrations: Record<string, string> }> {
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

export async function downloadCharacterAvatars(
  outputDir = 'public',
  launchBrowser: () => Promise<Browser> = () => chromium.launch({ headless: true })
): Promise<CharacterImageDownloadResult> {
  const projectRoot = outputDir === 'public' ? process.cwd() : resolve(outputDir, '..')
  const releasedNameToId = loadReleasedNameMap(projectRoot)
  const avatarDir = join(outputDir, 'images', 'characters')
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
    return skippedResult(`Skland character scrape failed: ${String(error)}`)
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
        return skippedResult(`Missing Skland image URL for avatar/${target.avatarId}`)
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
        return skippedResult(`Missing Skland image URL for fullBody/${target.fullBodyId}`)
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
    return skippedResult(`Skland character download failed: ${String(error)}`)
  }

  rmSync(avatarDir, { recursive: true, force: true })
  renameSync(tempDir, avatarDir)

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
  const previewManifestPath = join(
    projectRoot,
    'src',
    'generated',
    'data',
    'wiki',
    'preview-character-avatars.json'
  )
  mkdirSync(dirname(previewManifestPath), { recursive: true })
  writeFileSync(previewManifestPath, `${JSON.stringify(previewAvatars, null, 2)}\n`, 'utf8')
  return {
    avatars: jobs.filter((job) => job.kind === 'avatar').length,
    fullBody: jobs.filter((job) => job.kind === 'fullBody').length,
    previews: Object.keys(previewAvatars).length,
    skipped: false,
  }
}

function skippedResult(skipReason: string): CharacterImageDownloadResult {
  return { avatars: 0, fullBody: 0, previews: 0, skipped: true, skipReason }
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
