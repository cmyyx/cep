import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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

it('serializes source hashes in sources.json', () => {
  expect(serializeImageSources({
    'avatar/alpha': { source: 'skland', url: 'https://example.com/alpha.png', hash: 'abc123' },
  })).toBe(`{
  "avatar/alpha": {
    "source": "skland",
    "url": "https://example.com/alpha.png",
    "hash": "abc123"
  }
}
`)
})

it('reuses the committed avif when the source hash is unchanged', async () => {
  const publicDirectory = tempProject('cep-characters-reuse-', { chr_0004_pelica: '佩丽卡' })
  const png = await sharp({
    create: { width: 4, height: 4, channels: 4, background: '#ffffff' },
  }).png().toBuffer()
  const hash = createHash('sha256').update(png).digest('hex')

  const avatarDir = join(publicDirectory, 'images', 'characters')
  mkdirSync(join(avatarDir, 'full'), { recursive: true })
  // Intentionally non-avif bytes: if the skip works they are copied verbatim;
  // a re-encode would replace them with a real avif.
  writeFileSync(join(avatarDir, 'chr_0004_pelica.avif'), 'LEGACY-AVATAR')
  writeFileSync(join(avatarDir, 'full', 'chr_0004_pelica.avif'), 'LEGACY-FULL')
  writeFileSync(
    join(avatarDir, 'sources.json'),
    `${JSON.stringify(
      {
        'avatar/chr_0004_pelica': { source: 'skland', url: 'https://cdn.example/avatar.png', hash },
        'fullBody/chr_0004_pelica': { source: 'skland', url: 'https://cdn.example/full.png', hash },
      },
      null,
      2,
    )}\n`,
  )

  const browser = mockBrowser(
    catalogWith([{ itemId: 'pelica', name: '佩丽卡', brief: { cover: 'https://cdn.example/avatar.png' } }]),
    { data: { item: { document: { extraInfo: { illustration: 'https://cdn.example/full.png' } } } } },
  )
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
  })))

  const result = await downloadCharacterAvatars(publicDirectory, async () => browser as never)

  expect(result.skipped).toBe(false)
  expect(readFileSync(join(avatarDir, 'chr_0004_pelica.avif'), 'utf8')).toBe('LEGACY-AVATAR')
  expect(readFileSync(join(avatarDir, 'full', 'chr_0004_pelica.avif'), 'utf8')).toBe('LEGACY-FULL')
  const sources = JSON.parse(
    readFileSync(join(avatarDir, 'sources.json'), 'utf8'),
  ) as Record<string, { hash?: string }>
  expect(sources['avatar/chr_0004_pelica'].hash).toBe(hash)
  expect(sources['fullBody/chr_0004_pelica'].hash).toBe(hash)
})

it('re-encodes when the recorded source hash differs', async () => {
  const publicDirectory = tempProject('cep-characters-changed-', { chr_0004_pelica: '佩丽卡' })
  const png = await sharp({
    create: { width: 4, height: 4, channels: 4, background: '#ffffff' },
  }).png().toBuffer()

  const avatarDir = join(publicDirectory, 'images', 'characters')
  mkdirSync(join(avatarDir, 'full'), { recursive: true })
  writeFileSync(join(avatarDir, 'chr_0004_pelica.avif'), 'STALE-AVATAR')
  writeFileSync(
    join(avatarDir, 'sources.json'),
    `${JSON.stringify(
      {
        'avatar/chr_0004_pelica': {
          source: 'skland',
          url: 'https://cdn.example/avatar.png',
          hash: '0'.repeat(64),
        },
      },
      null,
      2,
    )}\n`,
  )

  const browser = mockBrowser(
    catalogWith([{ itemId: 'pelica', name: '佩丽卡', brief: { cover: 'https://cdn.example/avatar.png' } }]),
    { data: { item: { document: { extraInfo: { illustration: 'https://cdn.example/full.png' } } } } },
  )
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
  })))

  const result = await downloadCharacterAvatars(publicDirectory, async () => browser as never)

  expect(result.skipped).toBe(false)
  const avatar = readFileSync(join(avatarDir, 'chr_0004_pelica.avif'))
  // hash mismatch -> the stale placeholder is replaced by a real avif encode
  expect(avatar.equals(Buffer.from('STALE-AVATAR'))).toBe(false)
  expect(avatar.subarray(4, 8).toString('latin1')).toBe('ftyp')
})

it('re-encodes legacy entries that have no recorded hash', async () => {
  const publicDirectory = tempProject('cep-characters-legacy-', { chr_0004_pelica: '佩丽卡' })
  const png = await sharp({
    create: { width: 4, height: 4, channels: 4, background: '#ffffff' },
  }).png().toBuffer()

  const avatarDir = join(publicDirectory, 'images', 'characters')
  mkdirSync(avatarDir, { recursive: true })
  writeFileSync(join(avatarDir, 'chr_0004_pelica.avif'), 'LEGACY')
  writeFileSync(
    join(avatarDir, 'sources.json'),
    `${JSON.stringify(
      { 'avatar/chr_0004_pelica': { source: 'skland', url: 'https://cdn.example/avatar.png' } },
      null,
      2,
    )}\n`,
  )

  const browser = mockBrowser(
    catalogWith([{ itemId: 'pelica', name: '佩丽卡', brief: { cover: 'https://cdn.example/avatar.png' } }]),
    { data: { item: { document: { extraInfo: { illustration: 'https://cdn.example/full.png' } } } } },
  )
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
  })))

  const result = await downloadCharacterAvatars(publicDirectory, async () => browser as never)

  expect(result.skipped).toBe(false)
  const avatar = readFileSync(join(avatarDir, 'chr_0004_pelica.avif'))
  expect(avatar.equals(Buffer.from('LEGACY'))).toBe(false)
  const sources = JSON.parse(
    readFileSync(join(avatarDir, 'sources.json'), 'utf8'),
  ) as Record<string, { hash?: string }>
  expect(sources['avatar/chr_0004_pelica'].hash).toBe(createHash('sha256').update(png).digest('hex'))
})
