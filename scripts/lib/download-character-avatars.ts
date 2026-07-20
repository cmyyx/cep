import {
  existsSync,
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

const CATALOG_URL =
  'https://wiki.skland.com/endfield/catalog?mainTypeId=1&subTypeId=1&filterIds=&header=0'
const ADMINISTRATOR_ID = 'chr_9000_endmin'
const PREVIEW_ITEM_ID = '1683'
const DEPRECATED_IDS: Record<string, true> = {
  chr_0002_endminm: true,
  chr_0003_endminf: true,
}
const AVIF_OPTIONS = { quality: 60, chromaSubsampling: '4:4:4', effort: 4 } as const

interface ImageJob {
  id: string
  kind: 'avatar' | 'fullBody'
  remoteUrl?: string
  fallbackId: string
}

interface ImageSourceRecord {
  source: 'skland' | 'akedatabase'
  url?: string
  fallbackId?: string
}

export interface CharacterImageDownloadResult {
  avatars: number
  fullBody: number
  fallbacks: number
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

function fallbackIdFor(targetId: string): string {
  if (targetId === ADMINISTRATOR_ID || targetId.endsWith('-female')) {
    return 'chr_0003_endminf'
  }
  if (targetId.endsWith('-male')) return 'chr_0002_endminm'
  if (targetId === `skland-${PREVIEW_ITEM_ID}`) return 'chr_0034_liino'
  return targetId
}

function createFallbackTargets(
  releasedNameToId: Readonly<Record<string, string>>
): CharacterImageTarget[] {
  const targets: CharacterImageTarget[] = Object.entries(releasedNameToId).map(([name, id]) => ({
    itemId: '',
    name,
    avatarUrl: '',
    avatarId: id,
    fullBodyId: id,
  }))
  targets.push(
    {
      itemId: '',
      name: '管理员 (男)',
      avatarUrl: '',
      fullBodyId: `${ADMINISTRATOR_ID}-male`,
    },
    {
      itemId: '',
      name: '管理员 (女)',
      avatarUrl: '',
      avatarId: ADMINISTRATOR_ID,
      fullBodyId: `${ADMINISTRATOR_ID}-female`,
    },
    {
      itemId: PREVIEW_ITEM_ID,
      name: '梨诺',
      avatarUrl: '',
      avatarId: `skland-${PREVIEW_ITEM_ID}`,
    }
  )
  return targets
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

function mergeFallbackTargets(
  scraped: CharacterImageTarget[],
  fallback: CharacterImageTarget[]
): CharacterImageTarget[] {
  const avatarIds = new Set(scraped.flatMap((target) => (target.avatarId ? [target.avatarId] : [])))
  const fullBodyIds = new Set(
    scraped.flatMap((target) => (target.fullBodyId ? [target.fullBodyId] : []))
  )
  const merged = [...scraped]

  for (const target of fallback) {
    const needsAvatar = target.avatarId && !avatarIds.has(target.avatarId)
    const needsFullBody = target.fullBodyId && !fullBodyIds.has(target.fullBodyId)
    if (!needsAvatar && !needsFullBody) continue
    merged.push({
      ...target,
      avatarId: needsAvatar ? target.avatarId : undefined,
      fullBodyId: needsFullBody ? target.fullBodyId : undefined,
    })
  }
  return merged
}

async function fetchRemote(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function runPool<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>
): Promise<void> {
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const value = values[cursor]
        cursor += 1
        await worker(value)
      }
    })
  )
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
  akedatabasePath = resolve(process.cwd(), '..', 'AKEDatabase'),
  launchBrowser: () => Promise<Browser> = () => chromium.launch({ headless: true })
): Promise<CharacterImageDownloadResult> {
  const projectRoot = outputDir === 'public' ? process.cwd() : resolve(outputDir, '..')
  const releasedNameToId = loadReleasedNameMap(projectRoot)
  const fallbackTargets = createFallbackTargets(releasedNameToId)
  const avatarDir = join(outputDir, 'images', 'characters')
  const tempDir = join(dirname(avatarDir), `.characters-${process.pid}-${Date.now()}`)
  const tempFullDir = join(tempDir, 'full')
  mkdirSync(tempFullDir, { recursive: true })
  let scrapedTargets: CharacterImageTarget[] = []
  let illustrations: Record<string, string> = {}

  try {
    const browser = await launchBrowser()
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      const page = await context.newPage()
      const scraped = await collectSklandTargets(page, context, releasedNameToId)
      scrapedTargets = scraped.targets
      illustrations = scraped.illustrations
    } finally {
      await browser.close()
    }
  } catch (error) {
    console.warn(`  [characters] Skland unavailable, using local assets: ${String(error)}`)
  }
  const targets = mergeFallbackTargets(scrapedTargets, fallbackTargets)
  const jobs: ImageJob[] = []
  for (const target of targets) {
    if (target.avatarId) {
      jobs.push({
        id: target.avatarId,
        kind: 'avatar',
        remoteUrl: target.avatarUrl || undefined,
        fallbackId: fallbackIdFor(target.avatarId),
      })
    }
    if (target.fullBodyId) {
      jobs.push({
        id: target.fullBodyId,
        kind: 'fullBody',
        remoteUrl: illustrations[target.fullBodyId],
        fallbackId: fallbackIdFor(target.fullBodyId),
      })
    }
  }

  const sources: Record<string, ImageSourceRecord> = {}
  let fallbacks = 0
  try {
    await runPool(jobs, 6, async (job) => {
      let buffer: Buffer | null = null
      let usedFallback = false
      if (job.remoteUrl) {
        try {
          buffer = await fetchRemote(job.remoteUrl)
          sources[`${job.kind}/${job.id}`] = { source: 'skland', url: job.remoteUrl }
        } catch (error) {
          console.warn(`  [characters] ${job.id} download fallback: ${String(error)}`)
        }
      }

      if (!buffer) {
        const fallbackPath = join(
          akedatabasePath,
          'public',
          'images',
          'character',
          'charpic',
          `${job.fallbackId}.png`
        )
        if (!existsSync(fallbackPath)) {
          throw new Error(`Missing character image: ${job.id} (${fallbackPath})`)
        }
        buffer = readFileSync(fallbackPath)
        usedFallback = true
        fallbacks += 1
        sources[`${job.kind}/${job.id}`] = {
          source: 'akedatabase',
          fallbackId: job.fallbackId,
        }
      }

      let pipeline = sharp(buffer)
      if (job.kind === 'avatar' && usedFallback) {
        pipeline = pipeline.resize(456, 564, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
      }
      const destination = join(
        job.kind === 'avatar' ? tempDir : tempFullDir,
        `${job.id}.avif`
      )
      await pipeline.avif(AVIF_OPTIONS).toFile(destination)
    })

    writeFileSync(join(tempDir, 'sources.json'), serializeImageSources(sources), 'utf8')
    rmSync(avatarDir, { recursive: true, force: true })
    renameSync(tempDir, avatarDir)
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true })
    throw error
  }

  return {
    avatars: jobs.filter((job) => job.kind === 'avatar').length,
    fullBody: jobs.filter((job) => job.kind === 'fullBody').length,
    fallbacks,
  }
}

const isCli = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false

if (isCli) {
  downloadCharacterAvatars(process.argv[2] ?? 'public', process.argv[3]).then(
    (result) => console.log(`[characters] ${JSON.stringify(result)}`),
    (error: unknown) => {
      console.error(error)
      process.exitCode = 1
    }
  )
}
