#!/usr/bin/env node

/**
 * i18n key integrity checker.
 *
 * Detects:
 *   [P0 error]   Key used in source code but MISSING from one or more locale JSONs.
 *   [P1 warning] Key defined in some locales but MISSING from others (drift).
 *   [P2 warning] Key defined in ALL locales but NEVER referenced in code (dead key).
 *
 * Usage:
 *   node scripts/check-i18n.mjs            # checks all locales
 *   node scripts/check-i18n.mjs --quiet    # only print errors
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MESSAGES_DIR = join(ROOT, 'src', 'messages')
const SRC_DIR = join(ROOT, 'src')

const QUIET = process.argv.includes('--quiet')

// ─── Phase 1: Extract defined keys from locale JSONs ────────────────────────

function flattenJSON(obj, prefix = '') {
  const result = new Map()
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const nested = flattenJSON(v, fullKey)
      for (const [nk, nv] of nested) result.set(nk, nv)
    } else {
      result.set(fullKey, String(v))
    }
  }
  return result
}

function loadAllLocales() {
  const locales = new Map()
  const files = readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    const locale = file.replace('.json', '')
    const content = readFileSync(join(MESSAGES_DIR, file), 'utf-8')
    locales.set(locale, flattenJSON(JSON.parse(content)))
  }
  return locales
}

// ─── Phase 2: Extract used keys from source files ────────────────────────────

function walkSourceFiles() {
  const files = []
  const stack = [SRC_DIR]
  while (stack.length > 0) {
    const dir = stack.pop()
    if (!existsSync(dir)) continue
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.next' || e.name === 'generated') continue
        stack.push(fullPath)
      } else if (e.isFile() && /\.(tsx|ts)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
        // Skip test files
        if (/\.test\.(tsx|ts)$/.test(e.name)) continue
        files.push(fullPath)
      }
    }
  }
  return files
}

/**
 * Check if file is an i18n-aware file (uses useTranslations or receives t as prop).
 * This prevents false positives from test frameworks, local variables named t, etc.
 */
function isI18nFile(content) {
  if (/import\s+\{[^}]*\buseTranslations\b[^}]*\}\s+from\s+['"]next-intl['"]/.test(content)) return true
  if (/useTranslations\(/.test(content)) return true
  // File receives t as a prop (passed from a parent that uses useTranslations)
  if (/export\s+function\s+\w+\s*\([^)]*\bt\b[^)]*\)/.test(content)) return true
  // File has t('namespace.key') calls even if t comes from a parameter
  if (/\bt\(\s*['"]\w+\.\w+/.test(content)) return true
  return false
}

/**
 * Extract constant string values from source file.
 * Handles:
 *   - const X = [{ key: 'val' }, ...]         → {name}.{key} → ['val', ...]
 *   - const X: Record<K, string> = { k: 'v' } → {name} → ['v', ...]
 *   - const X = ['a', 'b'] as const           → {name} → ['a', 'b']
 *   - function f() { return 'str'; ... }      → {name} → ['str', ...]
 */
function extractConstants(source) {
  const constants = new Map()

  // Pattern A: const NAME = [{ key1: 'v1', key2: 'v2' }, ...]
  const arrayObjRe = /(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*\[([\s\S]*?)\]\s*(?:as\s+const)?\s*;?/gm
  for (const m of source.matchAll(arrayObjRe)) {
    const name = m[1]
    const body = m[2]
    const allProps = new Map() // propName → Set<value>
    for (const om of body.matchAll(/\{([^}]+)\}/g)) {
      for (const pm of om[1].matchAll(/(\w+)\s*:\s*['"]([^'"]+)['"]/g)) {
        if (!allProps.has(pm[1])) allProps.set(pm[1], new Set())
        allProps.get(pm[1]).add(pm[2])
      }
    }
    for (const [prop, vals] of allProps) {
      constants.set(`${name}.${prop}`, [...vals])
    }
  }

  // Pattern B: const NAME: Record<K, V> = { k1: 'v1', k2: 'v2' }
  const recordRe = /(?:const|let|var)\s+(\w+)(?:\s*:\s*Record<[^>]+>)?\s*=\s*\{([\s\S]*?)\}\s*(?:as\s+const)?\s*;?/gm
  for (const m of source.matchAll(recordRe)) {
    const name = m[1]
    const body = m[2]
    const values = []
    const byKey = new Map()
    for (const pm of body.matchAll(/(\w+)\s*:\s*['"]([^'"]+)['"]/g)) {
      values.push(pm[2])
      if (!byKey.has(pm[1])) byKey.set(pm[1], [])
      byKey.get(pm[1]).push(pm[2])
    }
    if (values.length > 0) {
      constants.set(name, values)
      for (const [k, v] of byKey) constants.set(`${name}.${k}`, v)
    }
  }

  // Pattern C: const NAME = ['a', 'b', 'c'] as const  (plain string array)
  const strArrayRe = /(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*\[([\s\S]*?)\]\s*as\s+const\s*;?/gm
  for (const m of source.matchAll(strArrayRe)) {
    const name = m[1]
    const body = m[2]
    const values = []
    for (const sm of body.matchAll(/['"]([^'"]+)['"]/g)) {
      values.push(sm[1])
    }
    if (values.length > 0) constants.set(name, values)
  }

  // Pattern D: function NAME() { ... return 'str'; ... }
  const funcRe = /function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{([\s\S]*?)\n\}/gm
  for (const m of source.matchAll(funcRe)) {
    const name = m[1]
    const values = []
    for (const rm of m[2].matchAll(/return\s+['"]([^'"]+)['"]/g)) {
      values.push(rm[1])
    }
    if (values.length > 0) constants.set(name, values)
  }

  return constants
}

/**
 * Extract all translation keys from a file (only if it's an i18n-aware file).
 *
 * @param {string} filePath
 * @param {Map<string, string[]>} globalConstants - constants pooled from ALL i18n files
 * @returns {{ keys: Set<string>, unresolved: string[] }}
 */
function extractKeys(filePath, globalConstants) {
  const content = readFileSync(filePath, 'utf-8')
  if (!isI18nFile(content)) return { keys: new Set(), unresolved: [] }

  const relPath = filePath.replace(ROOT + '/', '').replace(ROOT + '\\', '')
  const keys = new Set()
  const unresolved = []

  // ── Build .map() scope map (needed by multiple resolution steps) ──
  //    Each scope: { arrayName, bindings: [{ local, prop }], endPos }
  const mapScopes = []
  const mapRe = /(\w+)\.(?:flat)?[Mm]ap\(\s*\(\s*(\{[^}]+\}|\w+(?:\s*,\s*\w+)*)/g
  for (const mm of content.matchAll(mapRe)) {
    const arrayName = mm[1]
    const rawParams = mm[2]
    const bindings = []
    if (rawParams.startsWith('{')) {
      for (const dm of rawParams.matchAll(/(\w+)(?:\s*:\s*(\w+))?/g)) {
        bindings.push({ local: dm[2] || dm[1], prop: dm[1] })
      }
    } else {
      const firstVar = rawParams.split(',')[0].trim()
      if (firstVar) bindings.push({ local: firstVar, prop: null })
    }
    mapScopes.push({ arrayName, bindings, endPos: mm.index + mm[0].length })
  }

  function findNearestMap(pos) {
    let nearest = null
    for (const ms of mapScopes) {
      if (ms.endPos < pos) {
        if (!nearest || ms.endPos > nearest.endPos) nearest = ms
      }
    }
    return nearest
  }

  function resolveFromMapScope(ms, varName) {
    const binding = ms.bindings.find((b) => b.local === varName)
    if (!binding) return null
    if (binding.prop) {
      const propKey = `${ms.arrayName}.${binding.prop}`
      const vals = globalConstants.get(propKey)
      if (vals) return vals
    }
    return globalConstants.get(ms.arrayName) || null
  }

  // 1. Static keys: t('literal') or t("literal")
  for (const m of content.matchAll(/\bt\(\s*['"]([^'"]+)['"]\s*[,)]/g)) {
    const k = m[1]
    if (/^\w+(\.\w+)+$/.test(k)) keys.add(k)
  }

  // 2. Dynamic: t(VAR) — resolve from .map() scope first, then global constants
  for (const m of content.matchAll(/\bt\(\s*(\w+)\s*[,)]/g)) {
    const vn = m[1]
    if (vn.length <= 2) continue
    if (/^(count|index|days|time|params|candidates|duration|locale|timer|resolve|password|doRefresh|doFit|selectedWeaponIds|expandedDungeonIds|expandedPlanKeys|onLoginSubmit|onRegisterSubmit)$/.test(vn)) continue

    const nearestMap = findNearestMap(m.index)
    let found = false
    if (nearestMap) {
      const vals = resolveFromMapScope(nearestMap, vn)
      if (vals) { for (const v of vals) keys.add(v); found = true }
    }
    if (!found) found = resolveVar(vn, globalConstants, keys)
    if (!found && !QUIET) unresolved.push(`${relPath}: t(${vn})`)
  }

  // 3. Lookup: t(LOOKUP[key]) — bracket notation
  for (const m of content.matchAll(/\bt\(\s*(\w+)\[(\w+)\]\s*[,)]/g)) {
    const vals = globalConstants.get(m[1])
    if (vals) { for (const v of vals) keys.add(v) }
    else if (!QUIET) unresolved.push(`${relPath}: t(${m[1]}[...])`)
  }

  // 4. Property access: t(var.prop) — dot notation (e.g. t(tab.labelKey))
  for (const m of content.matchAll(/\bt\(\s*(\w+)\.(\w+)\s*[,)]/g)) {
    const varName = m[1]
    const propName = m[2]
    const nearestMap = findNearestMap(m.index)
    if (nearestMap) {
      const binding = nearestMap.bindings.find((b) => b.local === varName)
      if (binding) {
        const propKey = `${nearestMap.arrayName}.${propName}`
        const vals = globalConstants.get(propKey)
        if (vals) { for (const v of vals) keys.add(v); continue }
      }
    }
    if (!QUIET) unresolved.push(`${relPath}: t(${varName}.${propName})`)
  }

  // 5. Template: t(`prefix${VAR}suffix`)
  for (const m of content.matchAll(/\bt\(\s*`([^`]+)`\s*[,)]/g)) {
    const template = m[1]
    const templatePos = m.index
    const parts = template.split(/\$\{(\w+)\}/)
    if (parts.length === 1) { keys.add(template); continue }

    const varNames = []
    for (let i = 1; i < parts.length; i += 2) varNames.push(parts[i])

    const nearestMap = findNearestMap(templatePos)

    const resolved = varNames.map((vn) => {
      if (nearestMap) {
        const vals = resolveFromMapScope(nearestMap, vn)
        if (vals) return vals
      }
      const dv = globalConstants.get(vn)
      if (dv) return dv
      for (const [cName, cValues] of globalConstants) {
        if (cName.endsWith(`.${vn}`)) return cValues
      }
      return null
    })

    if (resolved.some((r) => r === null)) {
      if (!QUIET) unresolved.push(`${relPath}: t(\`${template}\`)`)
      continue
    }

    const count = resolved[0].length
    for (let i = 0; i < count; i++) {
      let expanded = ''
      for (let j = 0; j < parts.length; j++) {
        if (j % 2 === 0) expanded += parts[j]
        else expanded += resolved[Math.floor(j / 2)][i]
      }
      keys.add(expanded)
    }
  }

  return { keys, unresolved }
}

/**
 * Try to resolve a variable name to string values from the constant pool.
 */
function resolveVar(varName, constants, targetSet) {
  // Direct match: variable name is a known constant array
  const direct = constants.get(varName)
  if (direct) { for (const v of direct) targetSet.add(v); return true }

  // Property match: ONLY match when the variable name is specific enough
  // (not generic names like 'key', 'name', 'value' that cause false positives)
  if (/^(key|name|value|label|id|type|title|text|item)$/.test(varName)) return false

  for (const [cn, cv] of constants) {
    if (cn.endsWith(`.${varName}`)) {
      for (const v of cv) targetSet.add(v)
      return true
    }
  }

  // Cross-file prop tracing: e.g., greetingKey → getGreetingKey()
  if (varName.endsWith('Key')) {
    const funcName = `get${varName.charAt(0).toUpperCase() + varName.slice(1)}`
    const funcVals = constants.get(funcName)
    if (funcVals) { for (const v of funcVals) targetSet.add(v); return true }
  }

  return false
}

// ─── Phase 3: Cross-reference ───────────────────────────────────────────────

function check(locales, usedKeys, unresolved) {
  const errors = []
  const warnings = []
  const info = []
  const localeNames = [...locales.keys()]

  // All keys across all locales
  const allDefined = new Set()
  for (const [, keys] of locales) for (const k of keys.keys()) allDefined.add(k)

  // Keys in every locale
  const common = new Set(allDefined)
  for (const [, keys] of locales) for (const k of common) { if (!keys.has(k)) common.delete(k) }

  // P0: used but missing
  for (const key of [...usedKeys].sort()) {
    for (const locale of localeNames) {
      if (!locales.get(locale).has(key)) {
        errors.push(`[P0] key "${key}" used in code but MISSING from ${locale}.json`)
      }
    }
  }

  // P1: drift between locales
  for (const key of [...allDefined].sort()) {
    const withL = localeNames.filter((l) => locales.get(l).has(key))
    const without = localeNames.filter((l) => !locales.get(l).has(key))
    if (withL.length > 0 && without.length > 0) {
      warnings.push(`[P1] key "${key}" in [${withL.join(', ')}] but MISSING from [${without.join(', ')}]`)
    }
  }

  // P2: dead keys
  for (const key of [...common].sort()) {
    if (!usedKeys.has(key)) {
      warnings.push(`[P2] key "${key}" defined in all locales but NEVER used in code`)
    }
  }

  // Unresolved dynamic keys
  if (unresolved.length > 0) {
    info.push(`[INFO] ${unresolved.length} dynamic key(s) could not be statically resolved:`)
    for (const u of unresolved) info.push(`  ${u}`)
    info.push('  (Review manually if these should reference i18n keys.)')
  }

  return { errors, warnings, info, exitCode: errors.length > 0 ? 1 : 0 }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('=== i18n Key Integrity Check ===\n')

  // Phase 1: Load locales
  const locales = loadAllLocales()
  console.log(`Locales: ${[...locales.keys()].join(', ')}`)
  for (const [name, keys] of locales) console.log(`  ${name}: ${keys.size} keys`)
  console.log()

  // Phase 2a: Pool constants from ALL i18n files (for cross-file resolution)
  const globalConstants = new Map()
  const allFiles = walkSourceFiles()
  for (const f of allFiles) {
    const content = readFileSync(f, 'utf-8')
    if (isI18nFile(content)) {
      const fc = extractConstants(content)
      for (const [k, v] of fc) {
        if (!globalConstants.has(k)) globalConstants.set(k, v)
        else {
          // Merge: add values not already present
          const existing = new Set(globalConstants.get(k))
          for (const val of v) existing.add(val)
          globalConstants.set(k, [...existing])
        }
      }
    }
  }

  // Phase 2b: Extract keys from i18n files, using the pooled constants
  const usedKeys = new Set()
  const allUnresolved = []
  for (const f of allFiles) {
    const { keys, unresolved } = extractKeys(f, globalConstants)
    for (const k of keys) usedKeys.add(k)
    allUnresolved.push(...unresolved)
  }
  console.log(`Static + resolved keys found in code: ${usedKeys.size}\n`)

  // Phase 3: Check
  const { errors, warnings, info, exitCode } = check(locales, usedKeys, allUnresolved)

  if (errors.length > 0) {
    console.log(`─── ERRORS (${errors.length}) ───\n`)
    for (const e of errors) console.log(`  ${e}`)
    console.log()
  }
  if (warnings.length > 0) {
    console.log(`─── WARNINGS (${warnings.length}) ───\n`)
    for (const w of warnings) console.log(`  ${w}`)
    console.log()
  }
  if (info.length > 0) {
    for (const i of info) console.log(i)
    console.log()
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('OK — all i18n keys are consistent.\n')
  } else if (errors.length === 0) {
    console.log(`DONE with ${warnings.length} warning(s) (no errors).\n`)
  } else {
    console.log(`FAILED: ${errors.length} error(s), ${warnings.length} warning(s).\n`)
  }

  process.exit(exitCode)
}

main()
