import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, it, vi } from 'vitest'
import { convertWikiAssets } from './convert-icons'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function pngBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 2, height: 2, channels: 4, background: '#ffffff' },
  }).png().toBuffer()
}

it('fetches missing Wiki icons from the CDN layout and skips existing AVIF', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-icons-'))
  roots.push(root)
  const output = join(root, 'public')
  mkdirSync(join(output, 'images', 'weapon'), { recursive: true })
  await sharp({
    create: { width: 2, height: 2, channels: 4, background: '#00ff00' },
  }).avif().toFile(join(output, 'images', 'weapon', 'weapon.avif'))

  const requested: string[] = []
  const png = await pngBuffer()
  const result = await convertWikiAssets(output, {
    characters: [],
    characterFullBody: [],
    characterPotential: ['item_pic_1_chr_test'],
    weapons: ['weapon'],
    equipment: ['equipment'],
    skills: ['skill'],
    logisticsSkills: ['logistics'],
    materials: ['material'],
  }, {
    cdnBase: 'https://cdn.example',
    fetchPng: async (url) => {
      requested.push(url)
      return png
    },
  })

  expect(result.skipped).toEqual(['/images/weapon/weapon.avif'])
  expect(result.missingSource).toEqual([])
  expect(result.converted.sort()).toEqual([
    '/images/equip/equipment.avif',
    '/images/items/material.avif',
    '/images/wiki/character-potential/item_pic_1_chr_test.avif',
    '/images/wiki/logistics/logistics.avif',
    '/images/wiki/skills/skill.avif',
  ].sort())
  expect(requested.sort()).toEqual([
    'https://cdn.example/public/images/character/imagepoaster/largesize/pic_1_chr_test.png',
    'https://cdn.example/public/images/character/skillicon/skill.png',
    'https://cdn.example/public/images/character/spaceshipskillicon/logistics.png',
    'https://cdn.example/public/images/equip/iconbig/equipment.png',
    'https://cdn.example/public/images/item/itemiconbig/material.png',
  ].sort())
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
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error('temporary network failure'))
    .mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
    })
  vi.stubGlobal('fetch', fetchMock)

  const result = await convertWikiAssets(output, {
    characters: [],
    characterFullBody: [],
    characterPotential: [],
    weapons: ['retry-weapon'],
    equipment: [],
    skills: [],
    logisticsSkills: [],
    materials: [],
  })

  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls.every(([, init]) => init?.signal instanceof AbortSignal)).toBe(true)
  expect(result.converted).toEqual(['/images/weapon/retry-weapon.avif'])
})

it('converts up to six icons concurrently while preserving result order', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-icons-pool-'))
  roots.push(root)
  const output = join(root, 'public')
  const png = await pngBuffer()
  const ids = Array.from({ length: 8 }, (_, index) => `weapon-${index}`)
  let active = 0
  let maxActive = 0
  let releaseFetches!: () => void
  let reportSixStarted!: () => void
  const fetchGate = new Promise<void>((resolve) => { releaseFetches = resolve })
  const sixStarted = new Promise<void>((resolve) => { reportSixStarted = resolve })

  const conversion = convertWikiAssets(output, {
    characters: [],
    characterFullBody: [],
    characterPotential: [],
    weapons: ids,
    equipment: [],
    skills: [],
    logisticsSkills: [],
    materials: [],
  }, {
    fetchPng: async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      if (active === 6) reportSixStarted()
      await fetchGate
      active -= 1
      return png
    },
  })

  await sixStarted
  expect(maxActive).toBe(6)
  releaseFetches()
  const result = await conversion
  expect(result.converted).toEqual(ids.map((id) => `/images/weapon/${id}.avif`))
})
it('records missing sources when CDN fetch fails', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-icons-miss-'))
  roots.push(root)
  const output = join(root, 'public')
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

  const result = await convertWikiAssets(output, {
    characters: [],
    characterFullBody: [],
    characterPotential: [],
    weapons: ['missing-weapon'],
    equipment: [],
    skills: [],
    logisticsSkills: [],
    materials: [],
  }, {
    fetchPng: async () => {
      throw new Error('HTTP 404')
    },
  })

  expect(result.converted).toEqual([])
  expect(result.skipped).toEqual([])
  expect(result.missingSource).toEqual(['/images/weapon/missing-weapon.avif'])
  expect(existsSync(join(output, 'images/weapon/missing-weapon.avif'))).toBe(false)
  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining('missing-weapon.png'),
    expect.any(Error)
  )
})
