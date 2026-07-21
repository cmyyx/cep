import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import sharp from 'sharp'
import {
  buildCharacterImageTargets,
  collectIllustrationUrls,
  getCatalogItems,
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
}

export interface CharacterImageDownloadResult {
  avatars: number
  fullBody: number
  /**
   * Scrape was skipped — browser unavailable, network failed, or Skland response
   * lacked expected image URLs. Existing `images/characters` is left untouched so
   * prior sync output remains valid; callers should mark the PR accordingly.
   * ponytail: a partial scrape is never committed — on the first failure we bail
   * out of the whole step rather than ship an incomplete character set.
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
  context: BrowserContext,
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
  const catalogResponse = await responsePromise
  const targets = buildCharacterImageTargets(
    getCatalogItems(catalogPayload),
    releasedNameToId
  )
  const apiOrigin = new URL(catalogResponse.url()).origin
  const illustrations = await collectIllustrationUrls(targets, async (itemId) => {
    const response = await context.request.get(
      `${apiOrigin}/web/v1/wiki/item/info?id=${encodeURIComponent(itemId)}`,
      { timeout: 20_000, failOnStatusCode: true }
    )
    return response.json()
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
    const scraped = await collectSklandTargets(page, context, releasedNameToId)
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

  try {
    await runPool(jobs, 6, async (job) => {
      if (!job.remoteUrl) {
        throw new Error(`Missing Skland image URL for ${job.kind}/${job.id}`)
      }
      const buffer = await fetchRemoteWithRetry(job.remoteUrl, fetchRemote)
      sources[`${job.kind}/${job.id}`] = { source: 'skland', url: job.remoteUrl }
      const destination = join(
        job.kind === 'avatar' ? tempDir : tempFullDir,
        `${job.id}.avif`
      )
      await sharp(buffer).avif(AVIF_OPTIONS).toFile(destination)
    })

    writeFileSync(join(tempDir, 'sources.json'), serializeImageSources(sources), 'utf8')
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true })
    return skippedResult(`Skland character download failed: ${String(error)}`)
  }

  rmSync(avatarDir, { recursive: true, force: true })
  renameSync(tempDir, avatarDir)
  return {
    avatars: jobs.filter((job) => job.kind === 'avatar').length,
    fullBody: jobs.filter((job) => job.kind === 'fullBody').length,
    skipped: false,
  }
}

function skippedResult(skipReason: string): CharacterImageDownloadResult {
  return { avatars: 0, fullBody: 0, skipped: true, skipReason }
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
