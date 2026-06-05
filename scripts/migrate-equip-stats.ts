#!/usr/bin/env npx tsx
// Migrate RAW_EQUIPS sub1/sub2/special from CN stat names to canonical keys.
// ================================================================================

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEquipStatMapping } from './lib/equip-stat-mapping'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const config = JSON.parse(readFileSync(join(projectRoot, 'sync-game-data.config.json'), 'utf-8'))

const mapping = buildEquipStatMapping(config.akedataPath, config.translationPath)

function migrateStatString(raw: string): string {
  // Support both "意志+32" and "全伤害减免 17.2%" formats
  const match = raw.match(/^(.+?)\s*([+-]?\d+(?:\.\d+)?)(%?)$/)
  if (!match) return raw
  const name = match[1].trim()
  const value = match[2]
  const unit = match[3]
  const key = mapping.resolve(name)
  if (key === name) return raw
  // Normalize separator: always use + between key and value
  const sign = value.startsWith('+') || value.startsWith('-') ? '' : '+'
  return `${key}${sign}${value}${unit}`
}

const filePath = join(projectRoot, 'src', 'data', 'equips.ts')
const original = readFileSync(filePath, 'utf-8')

// Replace sub1/sub2/special string values
let migrated = original
let changed = 0

// Match sub1: 'xxx', sub2: 'xxx', special: 'xxx' in RAW_EQUIPS entries
const re = /\b(sub[12]|special):\s*'([^']+)'/g
migrated = migrated.replace(re, (full, field, value) => {
  const newValue = migrateStatString(value)
  if (newValue !== value) changed++
  return `${field}: '${newValue}'`
})

writeFileSync(filePath, migrated, 'utf-8')
console.log(`Migrated ${changed} stat strings in equips.ts`)
