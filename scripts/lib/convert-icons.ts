// Converts game icons from upstream PNG to project AVIF format.
// Both weapons and equips use the iconbig/ source directory.
// Only converts images that are referenced in project data files.
// ================================================================================
// Parameters: quality 50, chroma 4:2:0, effort 4

import { existsSync, readdirSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const AVIF_OPTIONS = { quality: 50, chromaSubsampling: '4:2:0', effort: 4 }

export interface IconConversionResult {
  converted: string[]
  skipped: string[]
  missingSource: string[]
}

/**
 * Convert only the specified PNG icons from AKEDatabase to AVIF.
 * `targetIds` is a list of icon filenames WITHOUT extension (e.g. "wpn_sword_0017").
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
    // Both weapon and equip large icons are in iconbig/
    const srcDir = join(akedatabasePath, 'public', 'images', category, 'iconbig')
    const outDir = join(projectPublicDir, 'images', category)
    mkdirSync(outDir, { recursive: true })

    if (!existsSync(srcDir)) {
      console.warn(`  [icons] source dir not found: ${srcDir}`)
      // Mark all targets for this category as missing source
      for (const id of targetIds) {
        if (id.startsWith(category === 'weapon' ? 'wpn_' : 'item_equip_')) {
          result.missingSource.push(`${category}/${id}.png`)
        }
      }
      continue
    }

    for (const file of readdirSync(srcDir)) {
      if (!file.endsWith('.png')) continue
      const id = file.replace('.png', '')
      if (!targetSet.has(id)) continue

      const srcPath = join(srcDir, file)
      const outPath = join(outDir, file.replace('.png', '.avif'))

      if (existsSync(outPath)) {
        result.skipped.push(file)
        continue
      }

      try {
        const pngBuffer = readFileSync(srcPath)
        const avifBuffer = await sharp(pngBuffer)
          .avif(AVIF_OPTIONS)
          .toBuffer()
        const { writeFileSync } = await import('node:fs')
        writeFileSync(outPath, avifBuffer)
        result.converted.push(file)
      } catch (err) {
        console.warn(`  [icons] failed to convert ${file}: ${err}`)
      }
    }
  }

  return result
}
