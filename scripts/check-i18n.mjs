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

// ── Runtime key whitelist ───────────────────────────────────────────────────
// Some i18n keys are only accessed at runtime via dynamic patterns that
// static analysis cannot resolve (e.g. t(`auth.${serverError}`),
// t(syncError), t(item.key)).  These keys would be flagged as P2 "dead"
// even though they are genuinely used in production.
//
// To keep the checker clean, we maintain a whitelist file at:
//   scripts/.i18n-known-keys.json
//
// When to add a key to the whitelist:
//   1. The key is used via a TEMPLATE LITERAL whose variable comes from
//      a runtime source (API response, useState, react-hook-form).
//   2. The key is used via a STATE VARIABLE (t(syncError)) that is only
//      assigned at runtime.
//   3. The key is used in a NON-I18N file (hook / store) that doesn't
//      import useTranslations, so the checker never scans it.
//   4. The key appears only in a ZOD SCHEMA or react-hook-form validation
//      config, not in a direct t() call.
//
// What the whitelist does NOT protect against:
//   - P0 errors: if a whitelisted key is MISSING from a locale JSON,
//     the checker will still report it.  The whitelist only suppresses P2.
//   - Accidental removal: if someone deletes a whitelisted key from ALL
//     locales, it won't be flagged as dead.  That's acceptable because
//     dead-key detection for runtime keys is inherently unreliable.
//
// When to REMOVE a key from the whitelist:
//   - The key is no longer defined in locale JSONs → delete the locale
//     key; the whitelist entry becomes harmless but should be cleaned up.
//   - The code has been refactored to use a direct t('literal') call
//     instead of a dynamic pattern.
//
function loadKnownRuntimeKeys() {
  const whitelistPath = join(__dirname, '.i18n-known-keys.json')
  const known = new Set()
  if (!existsSync(whitelistPath)) return known
  try {
    const data = JSON.parse(readFileSync(whitelistPath, 'utf-8'))
    const groups = data.runtimeKeys
    if (!groups) return known
    for (const [ns, group] of Object.entries(groups)) {
      if (!group.keys || !Array.isArray(group.keys)) continue
      // Determine the key prefix from the namespace.
      // "auth"          → "auth."
      // "auth.benefits" → "auth."  (same base namespace as auth)
      // "account"       → "account."
      const prefix = ns === 'auth' || ns.startsWith('auth.') ? 'auth.' : `${ns}.`
      for (const k of group.keys) {
        known.add(`${prefix}${k}`)
      }
    }
  } catch { /* malformed JSON — treat as empty */ }
  return known
}

// Load once at module init; set is small (~34 entries).
const KNOWN_RUNTIME_KEYS = loadKnownRuntimeKeys()

// Generic short variable names that are unlikely to be i18n keys
const GENERIC_VAR_NAMES = new Set([
  'key', 'name', 'value', 'label', 'id', 'type', 'title', 'text', 'item',
  'data', 'config', 'props', 'attr', 'field', 'option', 'status', 'code',
  'count', 'index', 'days', 'time', 'params', 'candidates', 'duration',
  'locale', 'timer', 'resolve', 'password',
])

// Project-specific identifiers that happen to match t(VAR) patterns but are not i18n keys.
const PROJECT_SPECIFIC_IGNORES = new Set([
  'doRefresh', 'doFit',
  'selectedWeaponIds', 'expandedDungeonIds', 'expandedPlanKeys',
  'onLoginSubmit', 'onRegisterSubmit',
])

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
        if (/\.test\.(tsx|ts)$/.test(e.name)) continue
        files.push(fullPath)
      }
    }
  }
  return files
}

/** Check if file is an i18n-aware file (uses useTranslations or receives t as prop). */
function isI18nFile(content) {
  if (/import\s+\{[^}]*\buseTranslations\b[^}]*\}\s+from\s+['"]next-intl['"]/.test(content)) return true
  if (/useTranslations\(/.test(content)) return true
  if (/export\s+function\s+\w+\s*\([^)]*\bt\b[^)]*\)/.test(content)) return true
  if (/\bt\(\s*['"]\w+\.\w+/.test(content)) return true
  return false
}

/** Check if file is a data file that exports strings/arrays/records relevant to i18n. */
function isDataFile(filePath, content) {
  return filePath.includes('/data/') && /\.ts$/.test(filePath) && !content.includes('import React')
}

/**
 * Extract constant string values from source file.
 */
function extractConstants(source) {
  const constants = new Map()

  // Pattern A: const NAME = [{ key1: 'v1', key2: 'v2' }, ...]
  const arrayObjRe = /(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*\[([\s\S]*?)\]\s*(?:as\s+const)?\s*;?/gm
  for (const m of source.matchAll(arrayObjRe)) {
    const name = m[1]
    const body = m[2]
    const allProps = new Map()
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
    for (const pm of body.matchAll(/(['"][^'"]+['"]|[\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+)\s*:\s*['"]([^'"]+)['"]/g)) {
      const val = pm[2]
      values.push(val)
      const rawKey = pm[1].replace(/^['"]|['"]$/g, '')
      if (!byKey.has(rawKey)) byKey.set(rawKey, [])
      byKey.get(rawKey).push(val)
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

  // Pattern E: export const NAME = [...new Set(data.map(...))].sort()
  // Captures the entire export — used by generated data that produces string arrays
  const exportArrayRe = /export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*\[([\s\S]*?)\]\s*(?:\.sort\(\))?\s*;?/gm
  for (const m of source.matchAll(exportArrayRe)) {
    const name = m[1]
    const body = m[2]
    const values = []
    for (const sm of body.matchAll(/['"]([^'"]+)['"]/g)) {
      values.push(sm[1])
    }
    if (values.length > 0) constants.set(name, values)
  }

  return constants
}

/**
 * Extract all translation keys from a file (only if it's an i18n-aware file).
 */
function extractKeys(filePath, globalConstants) {
  const content = readFileSync(filePath, 'utf-8')
  if (!isI18nFile(content)) return { keys: new Set(), unresolved: [] }

  const relPath = filePath.replace(ROOT + '/', '').replace(ROOT + '\\', '')
  const keys = new Set()
  const unresolved = []

  // ── Build .map() scope map ──
  const mapScopes = []
  const mapRe = /(\w+)\.(?:flat)?[Mm]ap\(\s*\(\s*(\{[^}]+\}|\[[^\]]+\]|\w+(?:\s*,\s*\w+)*)/g
  for (const mm of content.matchAll(mapRe)) {
    const arrayName = mm[1]
    const rawParams = mm[2]
    const bindings = []
    if (rawParams.startsWith('{')) {
      for (const dm of rawParams.matchAll(/(\w+)(?:\s*:\s*(\w+))?/g)) {
        bindings.push({ local: dm[2] || dm[1], prop: dm[1] })
      }
    } else if (rawParams.startsWith('[')) {
      // Destructured array: ([label, free, premium])
      const inner = rawParams.slice(1, -1)
      const vars = inner.split(',').map(s => s.trim())
      for (let i = 0; i < vars.length; i++) {
        bindings.push({ local: vars[i], prop: null })
      }
    } else {
      const firstVar = rawParams.split(',')[0].trim()
      if (firstVar) bindings.push({ local: firstVar, prop: null })
    }
    const startParenCount = (mm[0].match(/\(/g) || []).length
    const scanStart = mm.index + mm[0].length
    let depth = startParenCount
    let closePos = scanStart
    for (let i = scanStart; i < content.length && depth > 0; i++) {
      if (content[i] === '(') depth++
      else if (content[i] === ')') { depth--; if (depth === 0) { closePos = i; break } }
    }
    mapScopes.push({ arrayName, bindings, endPos: mm.index + mm[0].length, closePos })

    // Also extract inline array values: [['k1',...],['k2',...]].map(...)
    const inlineArray = extractInlineMapArray(content, mm.index, arrayName)
    if (inlineArray) {
      if (!globalConstants.has(arrayName)) globalConstants.set(arrayName, inlineArray)
      for (const binding of bindings) {
        if (binding.prop) {
          const propVals = extractInlineMapArrayProps(content, mm.index, binding.prop)
          if (propVals) globalConstants.set(`${arrayName}.${binding.prop}`, propVals)
        }
      }
    }
  }

  function findNearestMap(pos) {
    let nearest = null
    for (const ms of mapScopes) {
      if (ms.endPos < pos && pos < ms.closePos) {
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

  // 0. State-setter patterns: setSyncError('account.fetchSyncFailed')
  //    These values are later passed to t(varName), so add them directly.
  for (const m of content.matchAll(/\b(set\w+)\s*\(\s*['"]([^'"]+\.[^'"]+)['"]\s*[,)]/g)) {
    keys.add(m[2])
  }

  // 0b. String constants passed to objects that later reach t(entry.val):
  //    const X = [{ localVal: 'account.none', ... }]
  for (const m of content.matchAll(/['"](account\.[a-zA-Z]+)['"]/g)) {
    keys.add(m[1])
  }

  // 0c. Plain variable assignments: syncError = 'account.fetchSyncFailed'
  for (const m of content.matchAll(/\b(\w+Error|\w+Status)\s*=\s*['"]([a-z]+\.[a-zA-Z]+)['"]/g)) {
    keys.add(m[2])
  }

  // 1. Static keys: t('literal') or t("literal")
  for (const m of content.matchAll(/\bt\(\s*['"]([^'"]+)['"]\s*[,)]/g)) {
    const k = m[1]
    if (/^\w+(\.\w+)*$/.test(k)) keys.add(k)
  }

  // 2. Dynamic: t(VAR) — resolve from .map() scope first, then global constants
  for (const m of content.matchAll(/\bt\(\s*(\w+)\s*[,)]/g)) {
    const vn = m[1]
    if (vn.length <= 2) continue
    if (GENERIC_VAR_NAMES.has(vn) || PROJECT_SPECIFIC_IGNORES.has(vn)) continue

    const nearestMap = findNearestMap(m.index)
    let found = false
    if (nearestMap) {
      const vals = resolveFromMapScope(nearestMap, vn)
      if (vals) { for (const v of vals) keys.add(v); found = true }
    }
    if (!found) found = resolveVar(vn, globalConstants, keys)
    if (!found && !QUIET) unresolved.push(`${relPath}: t(${vn})`)
  }

  // 3. Lookup: t(LOOKUP[key]) — bracket notation (handles ?? fallback too)
  for (const m of content.matchAll(/\bt\(\s*(\w+)\[(\w+)\]/g)) {
    const vals = globalConstants.get(m[1])
    if (vals) { for (const v of vals) keys.add(v) }
    else if (!QUIET) unresolved.push(`${relPath}: t(${m[1]}[...])`)
  }

  // 4. Property access: t(var.prop) — dot notation (e.g. t(tab.labelKey))
  for (const m of content.matchAll(/\bt\(\s*(\w+)\.(\w+)\s*[,)]/g)) {
    const varName = m[1]
    const propName = m[2]
    const nearestMap = findNearestMap(m.index)
    let resolved = false
    if (nearestMap) {
      const binding = nearestMap.bindings.find((b) => b.local === varName)
      if (binding) {
        const propKey = `${nearestMap.arrayName}.${propName}`
        const vals = globalConstants.get(propKey)
        if (vals) { for (const v of vals) keys.add(v); resolved = true }
      }
    }
    if (!resolved) {
      const compositeKey = `${varName}.${propName}`
      const vals = globalConstants.get(compositeKey)
      if (vals) { for (const v of vals) keys.add(v); resolved = true }
    }
    if (!resolved && !QUIET) unresolved.push(`${relPath}: t(${varName}.${propName})`)
  }

  // 5. Template: t(`prefix${VAR}suffix`) — supports ${var} and ${var.prop}
  for (const m of content.matchAll(/\bt\(\s*`([^`]+)`\s*[,)]/g)) {
    const template = m[1]
    const templatePos = m.index
    // Split on ${...} capturing dotted names like ${entry.cloudVal}
    const parts = template.split(/\$\{([\w.]+)\}/)
    if (parts.length === 1) { keys.add(template); continue }

    const varNames = []
    for (let i = 1; i < parts.length; i += 2) varNames.push(parts[i])

    const nearestMap = findNearestMap(templatePos)

    function resolveTemplateVar(vn) {
      // Handle dotted access: ${entry.cloudVal}
      if (vn.includes('.')) {
        const [scopeVar, ...props] = vn.split('.')
        if (nearestMap) {
          const binding = nearestMap.bindings.find((b) => b.local === scopeVar)
          if (binding) {
            const chain = [binding.prop, ...props].filter(Boolean)
            for (let depth = chain.length; depth >= 0; depth--) {
              const pk = `${nearestMap.arrayName}.${chain.slice(0, depth).join('.')}`
              const vs = globalConstants.get(pk)
              if (vs) return vs
            }
            return null
          }
        }
        const fk = globalConstants.get(vn)
        if (fk) return fk
        const dotParts = vn.split('.')
        for (let d = dotParts.length - 1; d >= 0; d--) {
          const pk = dotParts.slice(0, d + 1).join('.')
          const vs = globalConstants.get(pk)
          if (vs) return vs
        }
        return null
      }

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
    }

    const resolved = varNames.map(resolveTemplateVar)

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

/** Extract string values from the first column of an inline array before .map() */
function extractInlineMapArray(content, mapStartPos, arrayName) {
  const before = content.slice(Math.max(0, mapStartPos - 3000), mapStartPos)
  // Match: [[ 'v1', ... ], [ 'v2', ... ]]  or  [{ label: 'v1' }, { label: 'v2' }]
  const m = before.match(/\[\[\s*['"]([^'"]+)['"]/g)
  if (m) {
    const values = []
    for (const match of m) {
      const v = match.match(/['"]([^'"]+)['"]/)
      if (v) values.push(v[1])
    }
    return values.length > 0 ? values : null
  }
  // Also try object array pattern: [{ label: 'v1', ... }, { label: 'v2', ... }]
  const objMatch = before.match(/\{\s*\w+\s*:\s*['"]([^'"]+)['"]/g)
  if (objMatch) {
    const values = []
    for (const match of objMatch) {
      const v = match.match(/['"]([^'"]+)['"]/)
      if (v && v[1].includes('.')) values.push(v[1])
    }
    return values.length > 0 ? values : null
  }
  return null
}

/** Extract property values from an inline object array before .map() */
function extractInlineMapArrayProps(content, mapStartPos, propName) {
  const before = content.slice(Math.max(0, mapStartPos - 2000), mapStartPos)
  // Match: { propName: 'v1', ... }, { propName: 'v2', ... }
  const re = new RegExp(`\\b${propName}\\s*:\\s*['"]([^'"]+)['"]`, 'g')
  const values = []
  for (const m of before.matchAll(re)) {
    values.push(m[1])
  }
  return values.length > 0 ? values : null
}

function resolveVar(varName, constants, targetSet) {
  const direct = constants.get(varName)
  if (direct) { for (const v of direct) targetSet.add(v); return true }

  if (GENERIC_VAR_NAMES.has(varName)) return false

  for (const [cn, cv] of constants) {
    if (cn.endsWith(`.${varName}`)) {
      for (const v of cv) targetSet.add(v)
      return true
    }
  }

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

  const allDefined = new Set()
  for (const [, keys] of locales) for (const k of keys.keys()) allDefined.add(k)

  const common = new Set(allDefined)
  for (const [, keys] of locales) for (const k of common) { if (!keys.has(k)) common.delete(k) }

  // P0: used but missing
  for (const key of [...usedKeys].sort()) {
    // Skip keys containing ${...} — these are unresolved template literals
    // that the checker couldn't expand. They are reported as INFO separately.
    if (key.includes('${')) continue

    for (const locale of localeNames) {
      const localeKeys = locales.get(locale)
      if (localeKeys.has(key)) continue
      if (!key.includes('.')) {
        const suffixMatch = [...localeKeys.keys()].some((dk) => dk.endsWith(`.${key}`))
        if (suffixMatch) continue
      }
      errors.push(`[P0] key "${key}" used in code but MISSING from ${locale}.json`)
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

  // P2: dead keys (skip keys known to be runtime-resolved)
  for (const key of [...common].sort()) {
    if (usedKeys.has(key)) continue
    if (KNOWN_RUNTIME_KEYS.has(key)) continue
    const lastDot = key.lastIndexOf('.')
    if (lastDot > 0 && usedKeys.has(key.slice(lastDot + 1))) continue
    warnings.push(`[P2] key "${key}" defined in all locales but NEVER used in code`)
  }

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

  const locales = loadAllLocales()
  console.log(`Locales: ${[...locales.keys()].join(', ')}`)
  for (const [name, keys] of locales) console.log(`  ${name}: ${keys.size} keys`)
  console.log()

  // Phase 2a: Pool constants from ALL i18n AND data files
  const globalConstants = new Map()
  const allFiles = walkSourceFiles()
  for (const f of allFiles) {
    const content = readFileSync(f, 'utf-8')
    if (isI18nFile(content) || isDataFile(f, content)) {
      const fc = extractConstants(content)
      for (const [k, v] of fc) {
        if (!globalConstants.has(k)) globalConstants.set(k, v)
        else {
          const existing = new Set(globalConstants.get(k))
          for (const val of v) existing.add(val)
          globalConstants.set(k, [...existing])
        }
      }
    }
  }

  // Phase 2b: Extract keys from i18n files
  const usedKeys = new Set()
  const allUnresolved = []
  for (const f of allFiles) {
    const { keys, unresolved } = extractKeys(f, globalConstants)
    for (const k of keys) usedKeys.add(k)
    allUnresolved.push(...unresolved)
  }
  console.log(`Static + resolved keys found in code: ${usedKeys.size}`)
  if (KNOWN_RUNTIME_KEYS.size > 0) {
    console.log(`Runtime-known keys (whitelisted, exempt from P2): ${KNOWN_RUNTIME_KEYS.size}`)
  }
  console.log()

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
