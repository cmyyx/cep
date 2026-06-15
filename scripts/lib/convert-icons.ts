// Converts game icons from upstream PNG to project AVIF format.
// Both weapons and equips use the iconbig/ source directory.
// Only converts images that are referenced in project data files.
// ================================================================================
// Parameters: quality 50, chroma 4:2:0, effort 4

import { existsSync, readdirSync, statSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const AVIF_OPTIONS = { quality: 50, chromaSubsampling: '4:2:0', effort: 4 }

export interface IconConversionResult {
  converted: string[]
  skipped: string[]
  missingSource: string[]
}

const CATEGORY_PREFIX: Record<string, string> = { weapon: 'wpn_', equip: 'item_equip_' }

/**
 * Convert only the specified PNG icons from AKEDatabase to AVIF.
 * `targetIds` is a list of icon filenames WITHOUT extension (e.g. "wpn_sword_0017").
 * Skips conversion when AVIF already exists and is not older than the source PNG.
 * Both weapon and equip icons are in iconbig/ under their respective category dirs.
 */
export async function convertIcons(
  akedatabasePath: string,
  projectPublicDir: string,
  categories: Array<'weapon' | 'equip'>,
  targetIds: string[],
): Promise<IconConversionResult> {
  const result: IconConversionResult = { converted: [], skipped: [], missingSource: [] }
  const targetSet = new Set(targetIds)

  for (const category of categories) {
    const srcDir = join(akedatabasePath, 'public', 'images', category, 'iconbig')
    const outDir = join(projectPublicDir, 'images', category)
    mkdirSync(outDir, { recursive: true })

    if (!existsSync(srcDir)) {
      console.warn(`  [icons] source dir not found: ${srcDir}`)
      const prefix = CATEGORY_PREFIX[category]
      for (const id of targetIds) {
        if (id.startsWith(prefix)) {
          result.missingSource.push(`${category}/${id}.png`)
        }
      }
      continue
    }

    const foundIds = new Set<string>()
    for (const file of readdirSync(srcDir)) {
      if (!file.endsWith('.png')) continue
      const id = file.replace('.png', '')
      if (!targetSet.has(id)) continue
      foundIds.add(id)

      const srcPath = join(srcDir, file)
      const outPath = join(outDir, file.replace('.png', '.avif'))

      // Skip if AVIF already exists and is not older than source PNG
      if (existsSync(outPath)) {
        const srcTime = statSync(srcPath).mtimeMs
        const outTime = statSync(outPath).mtimeMs
        if (outTime >= srcTime) {
          result.skipped.push(file)
          continue
        }
      }

      try {
        const pngBuffer = readFileSync(srcPath)
        const avifBuffer = await sharp(pngBuffer)
          .avif(AVIF_OPTIONS)
          .toBuffer()
        writeFileSync(outPath, avifBuffer)
        result.converted.push(file)
      } catch (err) {
        console.warn(`  [icons] failed to convert ${file}: ${err}`)
      }
    }
    // Report target IDs that have no matching PNG in iconbig
    const prefix = CATEGORY_PREFIX[category]
    for (const id of targetIds) {
      if (id.startsWith(prefix) && !foundIds.has(id)) {
        result.missingSource.push(`${category}/${id}.png`)
      }
    }
  }

  return result
}
