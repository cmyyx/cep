import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { validateImages } from './validate-data'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

it('validates every path declared by the generated Wiki asset manifest', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-assets-'))
  roots.push(root)
  const manifestDirectory = join(root, 'src/generated/data/wiki')
  mkdirSync(manifestDirectory, { recursive: true })
  writeFileSync(join(manifestDirectory, 'assets.json'), JSON.stringify({
    characters: ['character'],
    characterFullBody: ['full'],
    characterPotential: ['potential'],
    weapons: ['weapon'],
    equipment: ['equipment'],
    skills: ['skill'],
    logisticsSkills: ['logistics'],
    materials: ['material'],
  }))
  const existing = join(root, 'public/images/weapon')
  mkdirSync(existing, { recursive: true })
  writeFileSync(join(existing, 'weapon.avif'), 'present')

  expect(validateImages(root)).toEqual([
    '/images/characters/character.avif',
    '/images/characters/full/full.avif',
    '/images/wiki/character-potential/potential.avif',
    '/images/equip/equipment.avif',
    '/images/wiki/skills/skill.avif',
    '/images/wiki/logistics/logistics.avif',
    '/images/items/material.avif',
  ])
})
