/**
 * Build name-to-imageId mapping for weapons and equipment from AKEDatabase.
 *
 * Usage: node scripts/build-image-map.mjs
 * Output: src/data/equip-image-map.json, src/data/weapon-image-map.json
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const AKEDB = 'D:/GitHub/endfield-essence-planner/AKEDatabase/public/CH'
const IMAGE_DIR = 'D:/GitHub/endfield-essence-planner/image'
const OUTPUT_DIR = join(import.meta.dirname || '.', '..', 'src', 'data')

// Build weapon name -> imageId mapping
function buildWeaponMap() {
  const weaponDir = join(AKEDB, 'weapon')
  const files = readdirSync(weaponDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json')
  const map = {}
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(weaponDir, file), 'utf-8'))
      if (data.title && data.weaponId) {
        map[data.title] = data.weaponId
      }
    } catch {
      // skip
    }
  }
  return map
}

// Build equipment name -> imageId mapping
function buildEquipMap() {
  const equipDir = join(AKEDB, 'equip')
  const files = readdirSync(equipDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json')
  const map = {}
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(equipDir, file), 'utf-8'))
      if (data.equip && typeof data.equip === 'object') {
        for (const [itemId, item] of Object.entries(data.equip)) {
          if (item.name) {
            map[item.name] = itemId
          }
        }
      }
      // Also check top-level equip entries
      if (data.name && data.itemId) {
        map[data.name] = data.itemId
      }
      // Check for nested equip objects
      if (data.equips && typeof data.equips === 'object') {
        for (const [itemId, item] of Object.entries(data.equips)) {
          if (item.name) {
            map[item.name] = itemId
          }
        }
      }
    } catch {
      // skip
    }
  }
  return map
}

// Build item (material) name -> filename mapping
function buildItemMap() {
  const itemDir = join(IMAGE_DIR, 'item')
  if (!existsSync(itemDir)) return {}
  const files = readdirSync(itemDir).filter((f) => f.endsWith('.avif'))
  const map = {}
  for (const file of files) {
    const name = file.replace(/\.avif$/, '')
    map[name] = file
  }
  return map
}

// Check which weapon images actually exist
function checkExistingWeaponImages(weaponMap) {
  const weaponImgDir = join(IMAGE_DIR, 'weapon')
  const existingFiles = new Set(
    existsSync(weaponImgDir) ? readdirSync(weaponImgDir).filter((f) => f.endsWith('.avif')) : []
  )
  const result = {}
  for (const [name, id] of Object.entries(weaponMap)) {
    if (existingFiles.has(`${id}.avif`)) {
      result[name] = `${id}.avif`
    }
  }
  return result
}

// Check which equip images actually exist
function checkExistingEquipImages(equipMap) {
  const equipImgDir = join(IMAGE_DIR, 'equip')
  const existingFiles = new Set(
    existsSync(equipImgDir) ? readdirSync(equipImgDir).filter((f) => f.endsWith('.avif')) : []
  )
  const result = {}
  for (const [name, id] of Object.entries(equipMap)) {
    if (existingFiles.has(`${id}.avif`)) {
      result[name] = `${id}.avif`
    }
  }
  return result
}

// Main
const weaponMap = buildWeaponMap()
const equipMap = buildEquipMap()
const itemMap = buildItemMap()

const weaponImageMap = checkExistingWeaponImages(weaponMap)
const equipImageMap = checkExistingEquipImages(equipMap)

writeFileSync(join(OUTPUT_DIR, 'weapon-image-map.json'), JSON.stringify(weaponImageMap, null, 2))
writeFileSync(join(OUTPUT_DIR, 'equip-image-map.json'), JSON.stringify(equipImageMap, null, 2))
writeFileSync(join(OUTPUT_DIR, 'item-image-map.json'), JSON.stringify(itemMap, null, 2))

console.log(`Weapon images: ${Object.keys(weaponImageMap).length} mapped`)
console.log(`Equip images: ${Object.keys(equipImageMap).length} mapped`)
console.log(`Item images: ${Object.keys(itemMap).length} mapped`)

// Print some example mappings
console.log('\nSample weapon mappings:')
Object.entries(weaponImageMap).slice(0, 10).forEach(([name, id]) => console.log(`  ${name} -> ${id}`))

console.log('\nSample equip mappings:')
Object.entries(equipImageMap).slice(0, 10).forEach(([name, id]) => console.log(`  ${name} -> ${id}`))

console.log('\nSample item mappings:')
Object.entries(itemMap).slice(0, 10).forEach(([name, file]) => console.log(`  ${name} -> ${file}`))
