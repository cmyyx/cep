/**
 * Rebuild planner data (including SS farm yields) and wikiData dungeon labels.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { generateCharacterI18n } from './lib/generate-characters'
import { generateWikiData } from './lib/generate-wiki-data'

const projectRoot = process.cwd()
const configPath = join(projectRoot, 'sync-game-data.config.json')
if (!existsSync(configPath)) throw new Error('missing sync-game-data.config.json')
const config = JSON.parse(readFileSync(configPath, 'utf8')) as { akedataPath?: string; imagedbPath?: string }
if (!config.akedataPath || !config.imagedbPath) throw new Error('akedataPath and imagedbPath required')

const generatedRoot = join(projectRoot, 'src', 'generated', 'i18n')
const dataOutputDir = join(projectRoot, 'src', 'generated', 'data')

console.log('Regenerating character wiki + planner...')
const ch = generateCharacterI18n(config.akedataPath, config.imagedbPath, generatedRoot, dataOutputDir)
const wk = generateWikiData(config.akedataPath, config.imagedbPath, generatedRoot, dataOutputDir, ch.wikiData)
console.log(`Characters: ${ch.count}`)
console.log(`Planner/wiki files written: ${wk.files.length}`)
console.log('Done.')
