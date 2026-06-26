import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

export interface UpstreamPaths {
  akedata: string
  imagedb: string
}

/** Resolve upstream paths from CLI args, config file, or defaults. */
export function resolvePaths(cliArgs: Record<string, string>): UpstreamPaths {
  const fromCli = {
    akedata: cliArgs['akedata'] ?? cliArgs['a'] ?? '',
    imagedb: cliArgs['imagedb'] ?? cliArgs['i'] ?? '',
  }
  const fromConfig = readConfig()
  return {
    akedata: fromCli.akedata || fromConfig.akedata || join(process.cwd(), '..', 'upstream', 'AKEData'),
    imagedb: fromCli.imagedb || fromConfig.imagedb || join(process.cwd(), '..', 'upstream', 'AKEDatabase'),
  }
}

function readConfig(): Partial<UpstreamPaths> {
  const configPath = join(process.cwd(), 'sync-game-data.config.json')
  try {
    if (existsSync(configPath)) {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
      return {
        akedata: raw.akedata ?? raw.akedataPath ?? '',
        imagedb: raw.imagedb ?? raw.imagedbPath ?? '',
      }
    }
  } catch { /* ignore */ }
  return {}
}

export function sparseClone(repoUrl: string, targetDir: string, sparsePaths: string[]): void {
  if (existsSync(join(targetDir, '.git'))) {
    console.log(`  [upstream] ${targetDir} already exists, skipping clone`)
    return
  }
  console.log(`  [upstream] sparse cloning ${repoUrl} → ${targetDir}`)
  execFileSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', '--no-checkout', repoUrl, targetDir], { stdio: 'inherit' })
  execFileSync('git', ['-C', targetDir, 'sparse-checkout', 'init', '--cone'], { stdio: 'inherit' })
  execFileSync('git', ['-C', targetDir, 'sparse-checkout', 'set', ...sparsePaths], { stdio: 'inherit' })
  execFileSync('git', ['-C', targetDir, 'checkout'], { stdio: 'inherit' })
}

export function readJsonDir(dirPath: string): Record<string, unknown> {
  if (!existsSync(dirPath)) return {}
  const result: Record<string, unknown> = {}
  for (const file of readdirSync(dirPath)) {
    if (!file.endsWith('.json')) continue
    const stem = file.replace('.json', '')
    try { result[stem] = JSON.parse(readFileSync(join(dirPath, file), 'utf-8')) }
    catch { console.warn(`  [upstream] failed to parse ${file}, skipping`) }
  }
  return result
}

export function readTextTable(localeDir: string, locales: string[]): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {}
  for (const loc of locales) {
    const path = join(localeDir, `I18nTextTable_${loc}.json`)
    try { result[loc] = JSON.parse(readFileSync(path, 'utf-8')) }
    catch { console.warn(`  [upstream] missing TextTable for locale ${loc}`); result[loc] = {} }
  }
  return result
}

export function getRepoHead(repoPath: string): string {
  return execFileSync('git', ['-C', repoPath, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim()
}

export function getChangedOutputFiles(repoPath: string, fromSha: string, toSha: string): string[] {
  const output = execFileSync('git', ['-C', repoPath, 'diff', '--name-only', fromSha, toSha, '--', 'output/CN/'], { encoding: 'utf-8' }).trim()
  return output ? output.split('\n') : []
}

/**
 * Resolve a suit's display name from upstream data.
 * Uses v2_equip first, falls back to old-format equip JSON, finally the filename.
 * Both generate-metadata and update-data-files use this — ensures suits i18n
 * and RAW_EQUIPS data always agree on suit names.
 */
export function resolveSuitName(suitFile: string, imagedbPath: string): string {
  // 1. v2_equip: equipsuittable.list[0].suitName.text
  const v2Path = join(imagedbPath, 'public', 'CH', 'v2_equip', suitFile)
  if (existsSync(v2Path)) {
    try {
      const v2 = JSON.parse(readFileSync(v2Path, 'utf-8'))
      const text = v2?.equipsuittable?.list?.[0]?.suitName?.text as string | undefined
      if (text) return text
    } catch { /* ignore */ }
  }
  // 2. Old-format: 套組名称
  const oldPath = join(imagedbPath, 'public', 'CH', 'equip', suitFile)
  if (existsSync(oldPath)) {
    try {
      const old = JSON.parse(readFileSync(oldPath, 'utf-8'))
      const text = old['套组名称'] as string | undefined
      if (text) return text
    } catch { /* ignore */ }
  }
  // 3. Fallback: filename without .json
  return suitFile.replace('.json', '')
}

export function validatePaths(paths: UpstreamPaths): string[] {
  const warnings: string[] = []
  const checks: [string, string, string[]][] = [
    [paths.akedata, 'AKEData', ['output/CN/weapon', 'output/CN/equip', 'TableCfg']],
  ]
  for (const [rootPath, label, subdirs] of checks) {
    if (!existsSync(rootPath)) { warnings.push(`${label}: path not found - "${rootPath}"`); continue }
    for (const sub of subdirs) {
      if (!existsSync(join(rootPath, sub))) warnings.push(`${label}: missing expected subdirectory "${sub}"`)
    }
  }
  if (paths.imagedb && !existsSync(paths.imagedb)) warnings.push(`AKEDatabase: path not found — "${paths.imagedb}"`)
  return warnings
}
