import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, it, vi } from 'vitest'
import {
  downloadCharacterAvatars,
  serializeImageSources,
} from './download-character-avatars'
import { fetchRemoteWithRetry } from './wiki-builder-utils'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

it('serializes image sources in stable key order', () => {
  expect(serializeImageSources({
    'fullBody/zeta': { source: 'skland', url: 'https://example.com/zeta.png' },
    'avatar/alpha': { source: 'skland', url: 'https://example.com/alpha.png' },
    'avatar/beta': { source: 'skland', url: 'https://example.com/beta.png' },
  })).toBe(`{
  "avatar/alpha": {
    "source": "skland",
    "url": "https://example.com/alpha.png"
  },
  "avatar/beta": {
    "source": "skland",
    "url": "https://example.com/beta.png"
  },
  "fullBody/zeta": {
    "source": "skland",
    "url": "https://example.com/zeta.png"
  }
}
`)
})

it('retries once then throws on download failure', async () => {
  let attempts = 0
  await expect(
    fetchRemoteWithRetry('https://example.com/x.png', async () => {
      attempts += 1
      throw new Error(`fail-${attempts}`)
    })
  ).rejects.toThrow(/after retry/)
  expect(attempts).toBe(2)
})

it('succeeds on the second download attempt', async () => {
  let attempts = 0
  const buffer = await fetchRemoteWithRetry('https://example.com/x.png', async () => {
    attempts += 1
    if (attempts === 1) throw new Error('transient')
    return Buffer.from('ok')
  })
  expect(attempts).toBe(2)
  expect(buffer.toString()).toBe('ok')
})

/** Minimal browser/context/page mock driving the page-navigation scrape flow:
 * catalog response first, then an item/info response per detail navigation. */
function mockBrowser(
  catalog: unknown,
  itemInfo: unknown,
  goToUrls: string[] = []
) {
  const catalogResponse = {
    request: () => ({ method: () => 'GET' }),
    url: () => 'https://wiki.skland.com/web/v1/wiki/item/catalog?typeMainId=1&typeSubId=1',
    json: async () => catalog,
  }
  const infoResponse = {
    request: () => ({ method: () => 'GET' }),
    url: () => 'https://zonai.skland.com/web/v1/wiki/item/info?id=pelica',
    json: async () => itemInfo,
  }
  const page = {
    waitForResponse: async (predicate: (value: typeof catalogResponse) => Promise<boolean>) => {
      for (const candidate of [catalogResponse, infoResponse]) {
        if (await predicate(candidate)) return candidate
      }
      throw new Error('waitForResponse: no matching response (timeout)')
    },
    goto: async (url: string) => {
      goToUrls.push(url)
    },
  }
  const context = { newPage: async () => page }
  const browser = { newContext: async () => context, close: async () => undefined }
  return browser
}

function tempProject(name: string, characters: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), name))
  roots.push(root)
  const publicDirectory = join(root, 'public')
  mkdirSync(join(root, 'src/generated/i18n/characters'), { recursive: true })
  writeFileSync(
    join(root, 'src/generated/i18n/characters/zh-CN.json'),
    JSON.stringify(characters)
  )
  return publicDirectory
}

const catalogWith = (items: unknown[]) => ({
  data: {
    catalog: [{ id: '1', typeSub: [{ id: '1', items }] }],
  },
})

it('returns skipped when Chromium cannot launch', async () => {
  const publicDirectory = tempProject('cep-characters-', { chr_9000_endmin: '管理员' })

  const result = await downloadCharacterAvatars(publicDirectory, async () => {
    throw new Error('Chromium unavailable')
  })
  expect(result.skipped).toBe(true)
  expect(result.skipReason).toMatch(/Skland character scrape failed/)
  expect(result.avatars).toBe(0)
  expect(existsSync(join(publicDirectory, 'images/characters'))).toBe(false)
})

it('returns skipped when remote download fails after retry', async () => {
  const publicDirectory = tempProject('cep-characters-', { chr_0004_pelica: '佩丽卡' })
  const browser = mockBrowser(
    catalogWith([{ itemId: 'pelica', name: '佩丽卡', brief: { cover: 'https://invalid/avatar.png' } }]),
    { data: { item: { document: { extraInfo: { illustration: 'https://invalid/full.png' } } } } }
  )
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('download failed')
  }))

  const result = await downloadCharacterAvatars(publicDirectory, async () => browser as never)
  expect(result.skipped).toBe(true)
  expect(result.skipReason).toMatch(/download failed|after retry|Missing Skland/)
})

it.each([
  {
    kind: 'avatar',
    avatarUrl: '',
    detail: { data: { item: { document: { extraInfo: { illustration: 'https://cdn.example/full.png' } } } } },
  },
  {
    kind: 'fullBody',
    avatarUrl: 'https://cdn.example/avatar.png',
    detail: { data: { item: { document: {} } } },
  },
])('returns skipped when the $kind URL is missing', async ({ kind, avatarUrl, detail }) => {
  const publicDirectory = tempProject('cep-characters-missing-url-', { chr_0004_pelica: '佩丽卡' })
  const browser = mockBrowser(
    catalogWith([{ itemId: 'pelica', name: '佩丽卡', brief: { cover: avatarUrl } }]),
    detail
  )

  const result = await downloadCharacterAvatars(publicDirectory, async () => browser as never)
  expect(result.skipped).toBe(true)
  expect(result.skipReason).toBe(`Missing Skland image URL for ${kind}/chr_0004_pelica`)
  expect(readdirSync(join(publicDirectory, 'images'))).toEqual([])
})

it('writes avatars from successful Skland downloads', async () => {
  const publicDirectory = tempProject('cep-characters-ok-', { chr_0004_pelica: '佩丽卡' })

  const png = await sharp({
    create: { width: 4, height: 4, channels: 4, background: '#ffffff' },
  }).png().toBuffer()

  const goToUrls: string[] = []
  const browser = mockBrowser(
    catalogWith([{ itemId: 'pelica', name: '佩丽卡', brief: { cover: 'https://cdn.example/avatar.png' } }]),
    { data: { item: { document: { extraInfo: { illustration: 'https://cdn.example/full.png' } } } } },
    goToUrls
  )
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
  })))

  const result = await downloadCharacterAvatars(publicDirectory, async () => browser as never)

  expect(result.avatars).toBeGreaterThan(0)
  expect(result.skipped).toBe(false)
  expect(existsSync(join(publicDirectory, 'images/characters/chr_0004_pelica.avif'))).toBe(true)
  expect(existsSync(join(publicDirectory, 'images/characters/full/chr_0004_pelica.avif'))).toBe(true)
  expect(goToUrls).toContain('https://wiki.skland.com/endfield/detail?mainTypeId=1&subTypeId=1&gameEntryId=pelica&header=0')
})

it('keeps preview avatars when the preview full body is missing and writes the preview manifest', async () => {
  const publicDirectory = tempProject('cep-characters-preview-', { chr_0004_pelica: '佩丽卡' })

  const png = await sharp({
    create: { width: 4, height: 4, channels: 4, background: '#ffffff' },
  }).png().toBuffer()

  const browser = mockBrowser(
    catalogWith([
      { itemId: 'pelica', name: '佩丽卡', brief: { cover: 'https://cdn.example/avatar.png' } },
      { itemId: '9999', name: '未实装干员', brief: { cover: 'https://cdn.example/preview.png' } },
    ]),
    // info response only matches id=pelica — the preview entry gets no full body
    { data: { item: { document: { extraInfo: { illustration: 'https://cdn.example/full.png' } } } } }
  )
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
  })))

  const result = await downloadCharacterAvatars(publicDirectory, async () => browser as never)

  expect(result.skipped).toBe(false)
  expect(result.previews).toBe(1)
  expect(existsSync(join(publicDirectory, 'images/characters/preview-9999.avif'))).toBe(true)
  expect(existsSync(join(publicDirectory, 'images/characters/full/preview-9999.avif'))).toBe(false)
  const manifest = JSON.parse(
    readFileSync(
      join(publicDirectory, '..', 'src', 'generated', 'data', 'wiki', 'preview-character-avatars.json'),
      'utf8'
    )
  ) as Record<string, string>
  expect(manifest).toEqual({ 未实装干员: 'preview-9999' })
})
