import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import type { WikiAssets } from './wiki-assets'

const AVIF_OPTIONS = { quality: 50, chromaSubsampling: '4:2:0', effort: 4 } as const

interface AssetCategory {
  ids: string[]
  source: string[]
  output: string[]
  sourceId?: (id: string) => string
}

export interface IconConversionResult {
  converted: string[]
  skipped: string[]
  missingSource: string[]
}

export async function convertWikiAssets(
  akedatabasePath: string,
  projectPublicDir: string,
  assets: WikiAssets
): Promise<IconConversionResult> {
  const result: IconConversionResult = { converted: [], skipped: [], missingSource: [] }
  const categories: AssetCategory[] = [
    { ids: assets.weapons, source: ['weapon', 'iconbig'], output: ['images', 'weapon'] },
    { ids: assets.equipment, source: ['equip', 'iconbig'], output: ['images', 'equip'] },
    { ids: assets.materials, source: ['item', 'itemiconbig'], output: ['images', 'items'] },
    { ids: assets.skills, source: ['character', 'skillicon'], output: ['images', 'wiki', 'skills'] },
    {
      ids: assets.characterPotential,
      source: ['character', 'imagepoaster', 'largesize'],
      output: ['images', 'wiki', 'character-potential'],
      sourceId: (id) => id.replace(/^item_/, ''),
    },
    {
      ids: assets.logisticsSkills,
      source: ['character', 'spaceshipskillicon'],
      output: ['images', 'wiki', 'logistics'],
    },
  ]

  for (const category of categories) {
    const sourceDir = join(akedatabasePath, 'public', 'images', ...category.source)
    const outputDir = join(projectPublicDir, ...category.output)
    mkdirSync(outputDir, { recursive: true })

    for (const id of category.ids) {
      const sourcePath = join(sourceDir, `${category.sourceId?.(id) ?? id}.png`)
      const outputPath = join(outputDir, `${id}.avif`)
      const label = `/${category.output.join('/')}/${id}.avif`
      if (!existsSync(sourcePath)) {
        result.missingSource.push(label)
        continue
      }
      if (existsSync(outputPath) && statSync(outputPath).mtimeMs >= statSync(sourcePath).mtimeMs) {
        result.skipped.push(label)
        continue
      }
      await sharp(readFileSync(sourcePath)).avif(AVIF_OPTIONS).toFile(outputPath)
      result.converted.push(label)
    }
  }

  return result
}
