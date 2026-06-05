#!/usr/bin/env node
// Prebuild check: verify all weapon/equip images referenced in data files exist.
// Run before `next build` to fail early on missing images.
// ================================================================================

import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

// ── Check weapon images ──────────────────────────────────────────────────

const weaponsTsPath = join(root, 'src', 'data', 'weapons.ts')
const weaponsContent = readFileSync(weaponsTsPath, 'utf-8')

// Extract weapon IDs: id: 'wpn_xxx'
const weaponIdRe = /id:\s*'(wpn_[^']+)'/g
let m: RegExpExecArray | null
const missingWeaponImages: string[] = []
while ((m = weaponIdRe.exec(weaponsContent)) !== null) {
  const weaponId = m[1]
  if (weaponId.startsWith('preview:')) continue
  const avifPath = join(root, 'public', 'images', 'weapon', `${weaponId}.avif`)
  if (!existsSync(avifPath)) {
    missingWeaponImages.push(`weapon/${weaponId}.avif`)
  }
}

// ── Check equip images ───────────────────────────────────────────────────

const equipsTsPath = join(root, 'src', 'data', 'equips.ts')
const equipsContent = readFileSync(equipsTsPath, 'utf-8')

// Extract EQUIP_ID_MAP values: 'name': 'item_equip_xxx'
const equipIdRe = /':\s*'(item_equip_[^']+)'/g
const missingEquipImages: string[] = []
while ((m = equipIdRe.exec(equipsContent)) !== null) {
  const equipId = m[1]
  const avifPath = join(root, 'public', 'images', 'equip', `${equipId}.avif`)
  if (!existsSync(avifPath)) {
    missingEquipImages.push(`equip/${equipId}.avif`)
  }
}

// ── Report ────────────────────────────────────────────────────────────────

if (missingWeaponImages.length > 0) {
  console.error(`\nMissing weapon images (${missingWeaponImages.length}):`)
  missingWeaponImages.forEach(img => console.error(`  ${img}`))
}
if (missingEquipImages.length > 0) {
  console.error(`\nMissing equip images (${missingEquipImages.length}):`)
  missingEquipImages.forEach(img => console.error(`  ${img}`))
}

const total = missingWeaponImages.length + missingEquipImages.length
if (total > 0) {
  fail(`\n${total} missing image(s). Run \`pnpm sync:update --local\` to sync images.\n`)
}

console.log('All weapon/equip images present.')
