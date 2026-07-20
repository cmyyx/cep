import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, it } from 'vitest'
import { convertWikiAssets } from './convert-icons'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

it('converts each Wiki icon category from its canonical AKEDatabase directory', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-icons-'))
  roots.push(root)
  const upstream = join(root, 'upstream')
  const output = join(root, 'public')
  const fixtures = [
    ['weapon/iconbig', 'weapon'],
    ['equip/iconbig', 'equipment'],
    ['item/itemiconbig', 'material'],
    ['character/skillicon', 'skill'],
    ['character/spaceshipskillicon', 'logistics'],
  ] as const
  for (const [directory, id] of fixtures) {
    const path = join(upstream, 'public', 'images', directory)
    mkdirSync(path, { recursive: true })
    await sharp({
      create: { width: 2, height: 2, channels: 4, background: '#ffffff' },
    }).png().toFile(join(path, `${id}.png`))
  }

  const result = await convertWikiAssets(upstream, output, {
    characters: [],
    characterFullBody: [],
    characterPotential: [],
    weapons: ['weapon'],
    equipment: ['equipment'],
    skills: ['skill'],
    logisticsSkills: ['logistics'],
    materials: ['material'],
  })

  expect(result.missingSource).toEqual([])
  expect(existsSync(join(output, 'images/weapon/weapon.avif'))).toBe(true)
  expect(existsSync(join(output, 'images/equip/equipment.avif'))).toBe(true)
  expect(existsSync(join(output, 'images/items/material.avif'))).toBe(true)
  expect(existsSync(join(output, 'images/wiki/skills/skill.avif'))).toBe(true)
  expect(existsSync(join(output, 'images/wiki/logistics/logistics.avif'))).toBe(true)
})
