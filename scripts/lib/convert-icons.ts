// Converts game icons from upstream PNG to project AVIF format.
// ================================================================================
// Parameters: quality 50, chroma 4:2:0, effort 4

import { existsSync, readdirSync, statSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import sharp from 'sharp'

const AVIF_OPTIONS = { quality: 50, chromaSubsampling: '4:2:0', effort: 4 }

export interface IconConversionResult {
  converted: string[]
  skipped: string[]
  missingSource: string[]
}

/**
 * Convert PNG icons from AKEDatabase to AVIF in the project's public/images/ dir.
 */
export async function convertIcons(
  akedatabasePath: string,
  projectPublicDir: string,
  categories: string[],
): Promise<IconConversionResult> {
  const result: IconConversionResult = { converted: [], skipped: [], missingSource: [] }

  for (const category of categories) {
    // Equip icons are in iconbig/, weapon icons in icon/
    const iconSubdir = category === 'equip' ? 'iconbig' : 'icon'
    const srcDir = join(akedatabasePath, 'public', 'images', category, iconSubdir)
    const outDir = join(projectPublicDir, 'images', category)
    mkdirSync(outDir, { recursive: true })

    if (!existsSync(srcDir)) {
      console.warn(`  [icons] source dir not found: ${srcDir}`)
      continue
    }

    for (const file of readdirSync(srcDir)) {
      if (!file.endsWith('.png')) continue
      const srcPath = join(srcDir, file)
      const outPath = join(outDir, file.replace('.png', '.avif'))

      // Skip if AVIF is newer than source PNG
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

/**
 * Convert a single icon by game ID.
 */
export async function convertSingleIcon(
  akedatabasePath: string,
  projectPublicDir: string,
  category: string,
  iconFile: string,
  _gameId: string,
): Promise<string | null> {
  const srcPath = join(akedatabasePath, 'public', 'images', category, 'icon', iconFile)
  if (!existsSync(srcPath)) return null

  const outDir = join(projectPublicDir, 'images', category)
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, iconFile.replace('.png', '.avif'))

  const pngBuffer = readFileSync(srcPath)
  const avifBuffer = await sharp(pngBuffer).avif(AVIF_OPTIONS).toBuffer()
  const { writeFileSync } = await import('node:fs')
  writeFileSync(outPath, avifBuffer)
  return outPath
}
