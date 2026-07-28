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

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, resolve, dirname, relative, sep } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PUBLIC_DIR = join(ROOT, 'public')
const APP_DIR = join(ROOT, 'src', 'app')
const WEAPONS_TS = join(ROOT, 'src', 'data', 'weapons.ts')
const EQUIPS_TS = join(ROOT, 'src', 'data', 'equips.ts')
const WIKI_ASSETS = join(ROOT, 'src', 'generated', 'data', 'wiki', 'assets.json')

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

// ── Wiki asset manifest ──────────────────────────────────────────────────
if (existsSync(WIKI_ASSETS)) {
  const assets = JSON.parse(readFileSync(WIKI_ASSETS, 'utf-8'))
  const wikiPaths = [
    ...assets.characters.map((id) => `characters/${id}.avif`),
    ...assets.characterFullBody.map((id) => `characters/full/${id}.avif`),
    ...assets.characterPotential.map((id) => `wiki/character-potential/${id}.avif`),
    ...assets.weapons.map((id) => `weapon/${id}.avif`),
    ...assets.equipment.map((id) => `equip/${id}.avif`),
    ...assets.skills.map((id) => `wiki/skills/${id}.avif`),
    ...assets.logisticsSkills.map((id) => `wiki/logistics/${id}.avif`),
    ...assets.materials.map((id) => `items/${id}.avif`),
  ]
  for (const imagePath of wikiPaths) {
    if (!existsSync(join(PUBLIC_DIR, 'images', imagePath))) missing.push(imagePath)
  }
} else {
  missing.push('src/generated/data/wiki/assets.json')
}

// ── Oversized image guard ────────────────────────────────────────────────
// 背景: src/app/icon.svg 曾是一个 2.4MB 的「伪 SVG」(内嵌 base64 位图),
// 被当作 favicon + <Image priority> 混入每一页, 相同画面的 icon.png 只有 21KB。
// 这里对「会被 UI 常驻引用」的图片设体积上限, 防止同类资源再次混入。

const MAX_IMAGE_BYTES = 300 * 1024
const IMAGE_EXT_RE = /\.(svg|png|jpe?g|gif|webp|avif|ico)$/i

/**
 * 豁免目录: 内容型大图, 只在对应详情页按需(懒)加载, 不属于常驻 UI 资源。
 * 新增豁免必须在此写明理由。
 */
const SIZE_EXEMPT_DIRS = [
  join(PUBLIC_DIR, 'images', 'characters', 'full'), // 角色立绘, 仅角色详情页加载
  join(PUBLIC_DIR, 'images', 'wiki', 'character-potential'), // 潜能立绘, 仅详情页弹层加载
  join(PUBLIC_DIR, 'announcements'), // 公告配图截图, 仅公告面板展开时加载
]

/** 豁免文件: 平台规格要求的大尺寸图, 不随页面加载。 */
const SIZE_EXEMPT_FILES = [
  join(PUBLIC_DIR, 'CEP.png'), // 社交分享 / OG 原图
  join(PUBLIC_DIR, 'web-app-manifest-512x512.png'), // PWA maskable 512 图标
]

/**
 * 遗留超标文件白名单: 只警告不阻断。
 * 目前为空 —— 唯一的历史欠账 src/app/icon.svg (2.4MB 伪 SVG) 已删除。
 * 新增条目前请先确认是否真的无法压缩或替换。
 */
const SIZE_KNOWN_OFFENDERS = []

function* walkImages(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walkImages(full)
    } else if (entry.isFile() && IMAGE_EXT_RE.test(entry.name)) {
      yield full
    }
  }
}

function isSizeExempt(filePath) {
  if (SIZE_EXEMPT_FILES.includes(filePath)) return true
  return SIZE_EXEMPT_DIRS.some((dir) => filePath === dir || filePath.startsWith(dir + sep))
}

const oversized = []
const oversizedKnown = []
// public/**: 站点静态资源; src/app/*: Next metadata 图标文件约定 (icon/apple-icon/favicon)
const sizeTargets = [
  ...walkImages(PUBLIC_DIR),
  ...readdirSync(APP_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && IMAGE_EXT_RE.test(e.name))
    .map((e) => join(APP_DIR, e.name)),
]
for (const filePath of sizeTargets) {
  if (isSizeExempt(filePath)) continue
  const size = statSync(filePath).size
  if (size <= MAX_IMAGE_BYTES) continue
  const entry = { path: relative(ROOT, filePath).split(sep).join('/'), size }
  if (SIZE_KNOWN_OFFENDERS.includes(filePath)) oversizedKnown.push(entry)
  else oversized.push(entry)
}

for (const { path: p, size } of oversizedKnown) {
  console.warn(`check-images: WARN 遗留超标图片 ${p} (${(size / 1024).toFixed(1)}KB), 已无引用, 建议删除`)
}

if (oversized.length > 0) {
  console.error(`\nERROR: ${oversized.length} oversized image(s) (> ${Math.round(MAX_IMAGE_BYTES / 1024)}KB):`)
  for (const { path: p, size } of oversized.sort((a, b) => b.size - a.size)) {
    console.error(`  ${p}  ${(size / 1024).toFixed(1)}KB`)
  }
  console.error('\n压缩该图片, 或(仅内容型懒加载大图)在 scripts/check-images.mjs 的豁免列表中写明理由。')
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
  console.log('check-images: All planner and Wiki images present')
}
