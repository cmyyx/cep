/**
 * Migrate character guide data from old IIFE script format to clean JSON.
 *
 * Usage: node scripts/migrate-characters.mjs
 *
 * Input:  D:/GitHub/endfield-essence-planner/data/characters/*.js
 * Output: src/data/characters/*.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const OLD_DATA_DIR = 'D:/GitHub/endfield-essence-planner/data/characters'
const OUTPUT_DIR = join(projectRoot, 'src', 'data', 'characters')

// Character image mapping: name -> avif filename (without extension)
// Images are at D:/GitHub/endfield-essence-planner/image/characters/<name>.avif
const IMAGE_BASE = 'D:/GitHub/endfield-essence-planner/image/characters'

/** Extract character data from a single JS file */
function extractCharacterData(filePath) {
  const source = readFileSync(filePath, 'utf-8')
  const sandbox = { characters: [] }
  const fn = new Function('window', `${source}\nreturn window.characters;`)
  const result = fn(sandbox)
  const list = Array.isArray(result) ? result : sandbox.characters
  return list.length > 0 ? list[0] : null
}

/** Normalize a guide equip entry to object form */
function normalizeEquipEntry(entry) {
  if (!entry) return null
  if (typeof entry === 'string') {
    return { name: entry, icon: '', note: '', rarity: null }
  }
  return {
    name: String(entry.name || '').trim(),
    icon: String(entry.icon || '').trim(),
    note: String(entry.note || '').trim(),
    rarity: entry.rarity != null ? Number(entry.rarity) : null,
  }
}

/** Normalize a skill data table */
function normalizeSkillTables(tables) {
  if (!Array.isArray(tables)) return []
  return tables.map((table) => ({
    title: String(table.title || '技能数据').trim(),
    rows: (table.rows || []).map((row) => ({
      name: String(row.name || '').trim(),
      values: Array.isArray(row.values) ? row.values.map(String) : new Array(12).fill('-'),
    })),
  }))
}

export function normalizeCharacter(raw) {
  const c = { ...raw }

  // Normalize basic fields
  c.id = String(c.id || '').trim().toLowerCase()
  c.name = String(c.name || '').trim()
  c.rarity = Number(c.rarity) || 5
  c.element = String(c.element || '').trim()
  c.weaponType = String(c.weaponType || c.weaponType_ || '').trim()
  c.mainAbility = String(c.mainAbility || '').trim()
  c.subAbility = String(c.subAbility || '').trim()
  c.profession = String(c.profession || c.role || c.charClass || '').trim()

  // Normalize stats
  c.stats = {
    strength: String(c.stats?.strength || '').trim(),
    agility: String(c.stats?.agility || '').trim(),
    intellect: String(c.stats?.intellect || '').trim(),
    will: String(c.stats?.will || '').trim(),
    attack: String(c.stats?.attack || '').trim(),
    hp: String(c.stats?.hp || '').trim(),
  }

  // Normalize skills
  c.skills = (c.skills || []).map((skill) => ({
    name: String(skill.name || '').trim(),
    description: String(skill.description || '').trim(),
    icon: String(skill.icon || '').trim(),
    type: String(skill.type || '').trim(),
    dataTables: normalizeSkillTables(skill.dataTables || skill.dataTables_ || skill.data?.tables),
  }))

  // Normalize talents
  c.talents = (c.talents || []).map((t) => ({
    name: String(t.name || '').trim(),
    description: String(t.description || '').trim(),
    icon: String(t.icon || '').trim(),
  }))

  // Normalize base skills
  c.baseSkills = (c.baseSkills || []).map((b) => ({
    name: String(b.name || '').trim(),
    description: String(b.description || '').trim(),
    icon: String(b.icon || '').trim(),
  }))

  // Normalize potentials
  c.potentials = (c.potentials || []).map((p) => ({
    name: String(p.name || p.title || '').trim(),
    description: String(p.description || p.desc || '').trim(),
  }))

  // Normalize materials
  c.materials = {
    elite1: (c.materials?.elite1 || []).map(String).filter(Boolean),
    elite2: (c.materials?.elite2 || []).map(String).filter(Boolean),
    elite3: (c.materials?.elite3 || []).map(String).filter(Boolean),
    elite4: (c.materials?.elite4 || []).map(String).filter(Boolean),
  }

  // Normalize guide
  const guide = c.guide || {}
  c.guide = {
    equipRows: (guide.equipRows || []).map((row) => ({
      weapons: (row.weapons || []).map(normalizeEquipEntry).filter(Boolean),
      equipment: normalizeEquipSlots(row.equipment || []),
    })),
    analysis: String(guide.analysis || '').trim(),
    teamTips: String(guide.teamTips || '').trim(),
    operationTips: String(guide.operationTips || '').trim(),
    teamSlots: (guide.teamSlots || []).map((slot) => ({
      name: String(slot.name || '').trim(),
      note: String(slot.note || '').trim(),
      options: (slot.options || []).map((opt) => ({
        name: String(opt.name || '').trim(),
        tag: String(opt.tag || '').trim(),
        weapons: (opt.weapons || []).map(normalizeEquipEntry).filter(Boolean),
        equipment: (opt.equipment || []).map(normalizeEquipEntry).filter(Boolean),
      })),
    })),
    attributions: (guide.attributions || []).map((a) => ({
      role: String(a.role || '').trim(),
      name: String(a.name || '').trim(),
      url: String(a.url || '').trim(),
      note: String(a.note || '').trim(),
    })),
  }

  return c
}

/** Normalize equipment array to exactly 4 slots (null for empty) */
function normalizeEquipSlots(equipment) {
  const normalized = (equipment || []).slice(0, 4).map(normalizeEquipEntry)
  while (normalized.length < 4) normalized.push(null)
  return normalized
}

// ---- Main ----

const characterFiles = [
  'gilberta.js',
  'laevatain.js',
  'lifeng.js',
  'rossi.js',
  'tangtang.js',
  'zhuangfangyi.js',
]

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

const allData = []

for (const filename of characterFiles) {
  const filePath = join(OLD_DATA_DIR, filename)
  if (!existsSync(filePath)) {
    console.warn(`[WARN] File not found: ${filePath}`)
    continue
  }

  console.log(`Processing: ${filename}`)
  const raw = extractCharacterData(filePath)
  if (!raw) {
    console.warn(`[WARN] No data extracted from ${filename}`)
    continue
  }

  const normalized = normalizeCharacter(raw)

  // Write individual JSON file
  const outName = `${normalized.id}.json`
  const outPath = join(OUTPUT_DIR, outName)
  writeFileSync(outPath, JSON.stringify(normalized, null, 2), 'utf-8')
  console.log(`  -> ${outName}`)

  allData.push(normalized)
}

// Write all-in-one JSON
const allPath = join(OUTPUT_DIR, 'all.json')
writeFileSync(allPath, JSON.stringify(allData, null, 2), 'utf-8')
console.log(`\nWrote all.json with ${allData.length} characters.`)

// Generate TS index file
const indexLines = [
  '// Auto-generated by scripts/migrate-characters.mjs',
  '// Do not edit manually.',
  '',
  `import type { CharacterGuideData } from '@/types/character-guide'`,
  '',
]
for (const c of allData) {
  indexLines.push(`import ${c.id}Data from './${c.id}.json'`)
}
indexLines.push('')
indexLines.push('/** All character guide data, keyed by lowercase ID */')
indexLines.push('export const characterGuideData: Record<string, CharacterGuideData> = {')
for (const c of allData) {
  indexLines.push(`  '${c.id}': ${c.id}Data as CharacterGuideData,`)
}
indexLines.push('}')
indexLines.push('')
indexLines.push('/** Ordered list of character guide data */')
indexLines.push('export const characterGuideList: CharacterGuideData[] = [')
for (const c of allData) {
  indexLines.push(`  ${c.id}Data as CharacterGuideData,`)
}
indexLines.push(']')
indexLines.push('')
indexLines.push(`export type { CharacterGuideData }`)
indexLines.push('')

const indexPath = join(OUTPUT_DIR, 'index.ts')
writeFileSync(indexPath, indexLines.join('\n'), 'utf-8')
console.log(`Wrote index.ts`)

console.log('\nDone!')
