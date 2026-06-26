#!/usr/bin/env node

/**
 * Image integrity checker (prebuild gate).
 *
 * Verifies that every weapon/equip referenced in src/data/weapons.ts and
 * src/data/equips.ts has a corresponding AVIF image in public/images/.
 * Exits with code 1 if any image is missing, blocking the build.
 *
 * Usage:
 *   node scripts/check-images.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PUBLIC_DIR = join(ROOT, 'public')
const WEAPONS_TS = join(ROOT, 'src', 'data', 'weapons.ts')
const EQUIPS_TS = join(ROOT, 'src', 'data', 'equips.ts')

const missing = []

// ── Weapons ──────────────────────────────────────────────────────────────
if (existsSync(WEAPONS_TS)) {
  const content = readFileSync(WEAPONS_TS, 'utf-8')
  // 匹配每条 weapon entry 块，从块内提取 id + iconId
  // 优先用 iconId（游戏原始资源映射）；缺失时回退到 id
  // preview:xxx 跳过（无对应图片）
  const entryRe = /\{[^}]*\}/g
  let m
  while ((m = entryRe.exec(content)) !== null) {
    const entry = m[0]
    const idMatch = /id:\s*'([^']+)'/.exec(entry)
    if (!idMatch) continue
    const weaponId = idMatch[1]
    if (weaponId.startsWith('preview:')) continue
    const iconIdMatch = /iconId:\s*'([^']+)'/.exec(entry)
    const imageId = iconIdMatch?.[1] ?? weaponId
    const avifPath = join(PUBLIC_DIR, 'images', 'weapon', `${imageId}.avif`)
    if (!existsSync(avifPath)) {
      const ref = imageId === weaponId ? weaponId : `${imageId} (referenced by ${weaponId})`
      missing.push(`weapon/${ref}.avif`)
    }
  }
} else {
  console.error('ERROR: weapons.ts not found at', WEAPONS_TS)
  process.exit(1)
}

// ── Equips ───────────────────────────────────────────────────────────────
if (existsSync(EQUIPS_TS)) {
  const content = readFileSync(EQUIPS_TS, 'utf-8')
  const iconIds = new Set()
  const re = /(?:equipId|iconId):\s*'(item_equip_[^']+)'/g
  let m
  while ((m = re.exec(content)) !== null) {
    iconIds.add(m[1])
  }
  for (const equipId of iconIds) {
    const avifPath = join(PUBLIC_DIR, 'images', 'equip', `${equipId}.avif`)
    if (!existsSync(avifPath)) {
      missing.push(`equip/${equipId}.avif`)
    }
  }
} else {
  console.error('ERROR: equips.ts not found at', EQUIPS_TS)
  process.exit(1)
}

// ── Report ───────────────────────────────────────────────────────────────
if (missing.length > 0) {
  console.error(`\nERROR: ${missing.length} missing image(s):`)
  for (const img of missing) {
    console.error(`  ${img}`)
  }
  console.error('\nImages are required for build. Run sync:update to generate missing images.')
  process.exit(1)
} else {
  console.log('check-images: All weapon/equip images present')
}
