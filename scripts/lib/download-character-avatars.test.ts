import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, it, vi } from 'vitest'
import { downloadCharacterAvatars, serializeImageSources } from './download-character-avatars'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

it('serializes image sources in stable key order', () => {
  expect(serializeImageSources({
    'fullBody/zeta': { source: 'akedatabase', fallbackId: 'zeta' },
    'avatar/alpha': { source: 'skland', url: 'https://example.com/alpha.png' },
    'avatar/beta': { source: 'akedatabase', fallbackId: 'beta' },
  })).toBe(`{
  "avatar/alpha": {
    "source": "skland",
    "url": "https://example.com/alpha.png"
  },
  "avatar/beta": {
    "source": "akedatabase",
    "fallbackId": "beta"
  },
  "fullBody/zeta": {
    "source": "akedatabase",
    "fallbackId": "zeta"
  }
}\n`)
})

it('generates canonical administrator variants when Chromium cannot launch', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-characters-'))
  roots.push(root)
  const publicDirectory = join(root, 'public')
  const generatedDirectory = join(root, 'src/generated/i18n/characters')
  const upstreamDirectory = join(root, 'AKEDatabase/public/images/character/charpic')
  mkdirSync(generatedDirectory, { recursive: true })
  mkdirSync(upstreamDirectory, { recursive: true })
  writeFileSync(
    join(generatedDirectory, 'zh-CN.json'),
    JSON.stringify({ chr_9000_endmin: '管理员' })
  )
  for (const id of ['chr_0002_endminm', 'chr_0003_endminf', 'chr_0034_liino']) {
    await sharp({
      create: { width: 2, height: 2, channels: 4, background: '#ffffff' },
    }).png().toFile(join(upstreamDirectory, `${id}.png`))
  }

  let launchCalled = false
  const result = await downloadCharacterAvatars(
    publicDirectory,
    join(root, 'AKEDatabase'),
    async () => {
      launchCalled = true
      throw new Error('Chromium unavailable')
    }
  )

  expect(launchCalled).toBe(true)
  expect(result).toEqual({ avatars: 2, fullBody: 2, fallbacks: 4 })
  expect(existsSync(join(publicDirectory, 'images/characters/chr_9000_endmin.avif'))).toBe(true)
  expect(existsSync(join(publicDirectory, 'images/characters/full/chr_9000_endmin-female.avif'))).toBe(true)
  expect(existsSync(join(publicDirectory, 'images/characters/full/chr_9000_endmin-male.avif'))).toBe(true)
})

it('normalizes an avatar fallback after a remote download fails', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-characters-'))
  roots.push(root)
  const publicDirectory = join(root, 'public')
  const generatedDirectory = join(root, 'src/generated/i18n/characters')
  const upstreamDirectory = join(root, 'AKEDatabase/public/images/character/charpic')
  mkdirSync(generatedDirectory, { recursive: true })
  mkdirSync(upstreamDirectory, { recursive: true })
  writeFileSync(join(generatedDirectory, 'zh-CN.json'), JSON.stringify({ chr_0004_pelica: '佩丽卡' }))
  for (const id of ['chr_0004_pelica', 'chr_0002_endminm', 'chr_0003_endminf', 'chr_0034_liino']) {
    await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffffff' } })
      .png()
      .toFile(join(upstreamDirectory, `${id}.png`))
  }
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
    request: { get: async () => ({ json: async () => ({ data: { item: { document: { coverImages: ['https://invalid/full.png'] } } } }) }) },
  }
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('download failed') }))

  await downloadCharacterAvatars(
    publicDirectory,
    join(root, 'AKEDatabase'),
    async () => ({ newContext: async () => context, close: async () => undefined }) as never
  )

  const metadata = await sharp(join(publicDirectory, 'images/characters/chr_0004_pelica.avif')).metadata()
  expect(metadata).toMatchObject({ width: 456, height: 564 })
})
