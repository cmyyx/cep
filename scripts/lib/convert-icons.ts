import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import type { WikiAssets } from './wiki-assets'

const AVIF_OPTIONS = { quality: 50, chromaSubsampling: '4:2:0', effort: 4 } as const
export const AKE_DATA_CDN = 'https://data.akedata.wiki'

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

export interface ConvertWikiAssetsOptions {
  cdnBase?: string
  fetchPng?: (url: string) => Promise<Buffer>
}

async function defaultFetchPng(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

export async function convertWikiAssets(
  projectPublicDir: string,
  assets: WikiAssets,
  options: ConvertWikiAssetsOptions = {}
): Promise<IconConversionResult> {
  const result: IconConversionResult = { converted: [], skipped: [], missingSource: [] }
  const cdnBase = (options.cdnBase ?? AKE_DATA_CDN).replace(/\/$/, '')
  const fetchPng = options.fetchPng ?? defaultFetchPng
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
    const outputDir = join(projectPublicDir, ...category.output)
    mkdirSync(outputDir, { recursive: true })

    for (const id of category.ids) {
      const sourceName = `${category.sourceId?.(id) ?? id}.png`
      const outputPath = join(outputDir, `${id}.avif`)
      const label = `/${category.output.join('/')}/${id}.avif`
      if (existsSync(outputPath)) {
        result.skipped.push(label)
        continue
      }

      const url = `${cdnBase}/public/images/${category.source.join('/')}/${sourceName}`
      try {
        const buffer = await fetchPng(url)
        await sharp(buffer).avif(AVIF_OPTIONS).toFile(outputPath)
        result.converted.push(label)
      } catch {
        result.missingSource.push(label)
      }
    }
  }

  return result
}
