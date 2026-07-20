import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
}\n`)
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

it('throws when Chromium cannot launch (no local fallback)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-characters-'))
  roots.push(root)
  const publicDirectory = join(root, 'public')
  const generatedDirectory = join(root, 'src/generated/i18n/characters')
  mkdirSync(generatedDirectory, { recursive: true })
  writeFileSync(
    join(generatedDirectory, 'zh-CN.json'),
    JSON.stringify({ chr_9000_endmin: '管理员' })
  )

  await expect(
    downloadCharacterAvatars(publicDirectory, async () => {
      throw new Error('Chromium unavailable')
    })
  ).rejects.toThrow(/Skland character scrape failed/)
  expect(existsSync(join(publicDirectory, 'images/characters'))).toBe(false)
})

it('throws when remote download fails after retry (no AKEDatabase fallback)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-characters-'))
  roots.push(root)
  const publicDirectory = join(root, 'public')
  const generatedDirectory = join(root, 'src/generated/i18n/characters')
  mkdirSync(generatedDirectory, { recursive: true })
  writeFileSync(join(generatedDirectory, 'zh-CN.json'), JSON.stringify({ chr_0004_pelica: '佩丽卡' }))
  const catalog = {
    data: {
      catalog: [{ id: '1', typeSub: [{ id: '1', items: [{ itemId: 'pelica', name: '佩丽卡', brief: { cover: 'https://invalid/avatar.png' } }] }] }],
    },
  }
  const response = {
    request: () => ({ method: () => 'GET' }),
    url: () => 'https://wiki.skland.com/web/v1/wiki/item/catalog?typeMainId=1&typeSubId=1',
    json: async () => catalog,
  }
  const page = {
    waitForResponse: async (predicate: (value: typeof response) => Promise<boolean>) => {
      expect(await predicate(response)).toBe(true)
      return response
    },
    goto: async () => undefined,
  }
  const context = {
    newPage: async () => page,
    request: {
      get: async () => ({
        json: async () => ({ data: { item: { document: { coverImages: ['https://invalid/full.png'] } } } }),
      }),
    },
  }
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('download failed')
  }))

  await expect(
    downloadCharacterAvatars(
      publicDirectory,
      async () => ({ newContext: async () => context, close: async () => undefined }) as never
    )
  ).rejects.toThrow(/after retry|download failed|Missing Skland/)
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
])('removes temporary character data when the $kind URL is missing', async ({ kind, avatarUrl, detail }) => {
  const root = mkdtempSync(join(tmpdir(), 'cep-characters-missing-url-'))
  roots.push(root)
  const publicDirectory = join(root, 'public')
  const generatedDirectory = join(root, 'src/generated/i18n/characters')
  mkdirSync(generatedDirectory, { recursive: true })
  writeFileSync(join(generatedDirectory, 'zh-CN.json'), JSON.stringify({ chr_0004_pelica: '佩丽卡' }))
  const catalog = {
    data: {
      catalog: [{
        id: '1',
        typeSub: [{
          id: '1',
          items: [{ itemId: 'pelica', name: '佩丽卡', brief: { cover: avatarUrl } }],
        }],
      }],
    },
  }
  const response = {
    request: () => ({ method: () => 'GET' }),
    url: () => 'https://wiki.skland.com/web/v1/wiki/item/catalog?typeMainId=1&typeSubId=1',
    json: async () => catalog,
  }
  const page = {
    waitForResponse: async (predicate: (value: typeof response) => Promise<boolean>) => {
      expect(await predicate(response)).toBe(true)
      return response
    },
    goto: async () => undefined,
  }
  const context = {
    newPage: async () => page,
    request: { get: async () => ({ json: async () => detail }) },
  }

  await expect(downloadCharacterAvatars(
    publicDirectory,
    async () => ({ newContext: async () => context, close: async () => undefined }) as never
  )).rejects.toThrow(`Missing Skland image URL for ${kind}/chr_0004_pelica`)

  expect(readdirSync(join(publicDirectory, 'images'))).toEqual([])
})

it('writes avatars from successful Skland downloads', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-characters-ok-'))
  roots.push(root)
  const publicDirectory = join(root, 'public')
  const generatedDirectory = join(root, 'src/generated/i18n/characters')
  mkdirSync(generatedDirectory, { recursive: true })
  writeFileSync(join(generatedDirectory, 'zh-CN.json'), JSON.stringify({ chr_0004_pelica: '佩丽卡' }))

  const png = await sharp({
    create: { width: 4, height: 4, channels: 4, background: '#ffffff' },
  }).png().toBuffer()

  const catalog = {
    data: {
      catalog: [{
        id: '1',
        typeSub: [{
          id: '1',
          items: [{ itemId: 'pelica', name: '佩丽卡', brief: { cover: 'https://cdn.example/avatar.png' } }],
        }],
      }],
    },
  }
  const response = {
    request: () => ({ method: () => 'GET' }),
    url: () => 'https://wiki.skland.com/web/v1/wiki/item/catalog?typeMainId=1&typeSubId=1',
    json: async () => catalog,
  }
  const page = {
    waitForResponse: async (predicate: (value: typeof response) => Promise<boolean>) => {
      expect(await predicate(response)).toBe(true)
      return response
    },
    goto: async () => undefined,
  }
  const context = {
    newPage: async () => page,
    request: {
      get: async () => ({
        json: async () => ({
          data: { item: { document: { extraInfo: { illustration: 'https://cdn.example/full.png' } } } },
        }),
      }),
    },
  }
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
  })))

  const result = await downloadCharacterAvatars(
    publicDirectory,
    async () => ({ newContext: async () => context, close: async () => undefined }) as never
  )

  expect(result.avatars).toBeGreaterThan(0)
  expect(existsSync(join(publicDirectory, 'images/characters/chr_0004_pelica.avif'))).toBe(true)
})
