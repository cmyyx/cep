import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, it, vi } from 'vitest'
import { buildIconCdnUrl, convertWikiAssets } from './convert-icons'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function pngBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 2, height: 2, channels: 4, background: '#ffffff' },
  })
    .png()
    .toBuffer()
}

it('builds CDN urls under /public/images/assets/beyond/dynamicassets/gameplay/ui/', () => {
  expect(buildIconCdnUrl('https://cdn.example', ['sprites', 'itemiconbig'], 'wpn_x.png')).toBe(
    'https://cdn.example/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/wpn_x.png',
  )
  expect(buildIconCdnUrl('https://cdn.example', ['textures', 'spaceship', 'imageposter', 'largesize'], 'pic_1.png')).toBe(
    'https://cdn.example/public/images/assets/beyond/dynamicassets/gameplay/ui/textures/spaceship/imageposter/largesize/pic_1.png',
  )
})

it('fetches missing Wiki icons from the new public/images/assets/... layout and skips existing AVIF', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-icons-'))
  roots.push(root)
  const output = join(root, 'public')
  mkdirSync(join(output, 'images', 'weapon'), { recursive: true })
  await sharp({
    create: { width: 2, height: 2, channels: 4, background: '#00ff00' },
  })
    .avif()
    .toFile(join(output, 'images', 'weapon', 'weapon.avif'))

  const requested: string[] = []
  const png = await pngBuffer()
  const result = await convertWikiAssets(
    output,
    {
      characters: [],
      characterFullBody: [],
      characterPotential: ['item_pic_1_chr_test'],
      weapons: ['weapon'],
      equipment: ['equipment'],
      skills: ['skill'],
      logisticsSkills: ['logistics'],
      materials: ['material'],
    },
    {
      cdnBase: 'https://cdn.example',
      fetchPng: async (url) => {
        requested.push(url)
        return png
      },
    },
  )

  expect(result.skipped).toEqual(['/images/weapon/weapon.avif'])
  expect(result.missingSource).toEqual([])
  expect(result.converted.sort()).toEqual(
    [
      '/images/equip/equipment.avif',
      '/images/items/material.avif',
      '/images/wiki/character-potential/item_pic_1_chr_test.avif',
      '/images/wiki/logistics/logistics.avif',
      '/images/wiki/skills/skill.avif',
    ].sort(),
  )
  expect(requested.sort()).toEqual(
    [
      'https://cdn.example/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/equipment.png',
      'https://cdn.example/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/material.png',
      'https://cdn.example/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/skillicon/skill.png',
      'https://cdn.example/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/spaceship/spaceshipskillicon/logistics.png',
      'https://cdn.example/public/images/assets/beyond/dynamicassets/gameplay/ui/textures/spaceship/imageposter/largesize/pic_1_chr_test.png',
    ].sort(),
  )
  expect(existsSync(join(output, 'images/equip/equipment.avif'))).toBe(true)
  expect(existsSync(join(output, 'images/items/material.avif'))).toBe(true)
  expect(existsSync(join(output, 'images/wiki/skills/skill.avif'))).toBe(true)
  expect(existsSync(join(output, 'images/wiki/logistics/logistics.avif'))).toBe(true)
  expect(existsSync(join(output, 'images/wiki/character-potential/item_pic_1_chr_test.avif'))).toBe(true)
})

it('retries the default fetch with a timeout signal', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-icons-retry-'))
  roots.push(root)
  const output = join(root, 'public')
  const png = await pngBuffer()
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error('temporary network failure'))
    .mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
    })
  vi.stubGlobal('fetch', fetchMock)

  const result = await convertWikiAssets(
    output,
    {
      characters: [],
      characterFullBody: [],
      characterPotential: [],
      weapons: [],
      equipment: [],
      skills: ['skill_retry'],
      logisticsSkills: [],
      materials: [],
    },
    { cdnBase: 'https://cdn.example' },
  )

  expect(result.converted).toEqual(['/images/wiki/skills/skill_retry.avif'])
  expect(fetchMock).toHaveBeenCalled()
  const firstCall = fetchMock.mock.calls[0]
  expect(String(firstCall[0])).toContain(
    '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/skillicon/skill_retry.png',
  )
  expect(firstCall[1]?.signal).toBeInstanceOf(AbortSignal)
})
