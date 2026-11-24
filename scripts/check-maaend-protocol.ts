#!/usr/bin/env node

/**
 * MaaEND protocol drift checker (CI gate).
 *
 * The site is a static export, so it cannot poll upstream at runtime. This
 * script is how an upstream protocol change becomes visible *before* users hit
 * "the file may be corrupted":
 *
 *  - fetches `tools/schema/essence_inventory.schema.json` from MaaEnd v2,
 *  - hard-fails when `format` or `version.const` is gone or no longer matches
 *    the pinned baseline in `src/lib/essence-import/protocol.ts` (that is a real
 *    protocol change: adapt `maamend.ts`, then bump the pin),
 *  - only warns when the bytes changed but `format`/`version` did not (upstream
 *    promises same-version changes are additive, and the parser ignores unknown
 *    fields/enums),
 *  - exits 0 when the network is unavailable, unless `--strict` is passed, so a
 *    flaky runner cannot block merges.
 *
 * Usage:
 *   tsx scripts/check-maaend-protocol.ts [--strict] [--quiet]
 */

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  compareProtocol,
  FETCH_TIMEOUT_MS,
  isTransientHttpStatus,
  MAAEND_SCHEMA_URL,
  readPinnedProtocol,
} from './lib/maaend-protocol'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROTOCOL_TS = join(ROOT, 'src', 'lib', 'essence-import', 'protocol.ts')

const strict = process.argv.includes('--strict')
const quiet = process.argv.includes('--quiet')

async function main(): Promise<void> {
  const pinned = readPinnedProtocol(readFileSync(PROTOCOL_TS, 'utf8'))

  let response: Response
  try {
    response = await fetch(MAAEND_SCHEMA_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    // No server answer at all (offline / DNS / timeout / certificate): skip.
    const message = `无法拉取上游 schema（${error instanceof Error ? error.message : String(error)}）：${MAAEND_SCHEMA_URL}`
    if (strict) {
      console.error(`[maaend-protocol] ${message}`)
      process.exit(1)
    }
    if (!quiet) console.warn(`[maaend-protocol] 跳过检查：${message}`)
    return
  }

  if (!response.ok) {
    if (isTransientHttpStatus(response.status)) {
      // 429 / 5xx: the runner or GitHub is having a bad day, not a protocol change.
      const message = `上游 schema 暂时不可用（HTTP ${response.status}）：${MAAEND_SCHEMA_URL}`
      if (strict) {
        console.error(`[maaend-protocol] ${message}`)
        process.exit(1)
      }
      if (!quiet) console.warn(`[maaend-protocol] 跳过检查：${message}`)
      return
    }
    // 404/410 and friends: the schema moved or disappeared — that IS drift.
    console.error(
      `[maaend-protocol] 上游 schema 返回 HTTP ${response.status}：文件可能已被移动或删除，按协议漂移处理`,
    )
    console.error(`  ${MAAEND_SCHEMA_URL}`)
    process.exit(1)
  }

  const body = await response.text()

  let schema: { properties?: { format?: { const?: unknown }; version?: { const?: unknown } } }
  try {
    schema = JSON.parse(body)
  } catch {
    console.error('[maaend-protocol] 上游 schema 不是合法 JSON，协议可能刚被改动')
    process.exit(1)
  }

  const { errors, warnings } = compareProtocol(pinned, {
    format: schema?.properties?.format?.const,
    version: schema?.properties?.version?.const,
    hash: createHash('sha256').update(body).digest('hex'),
  })

  for (const warning of warnings) console.warn(`[maaend-protocol] warning: ${warning}`)

  if (errors.length > 0) {
    console.error('[maaend-protocol] 上游 MaaEND 协议已变更，需要适配：')
    for (const error of errors) console.error(`  - ${error}`)
    console.error('  步骤：读上游 schema → 改 src/lib/essence-import/maamend.ts →')
    console.error(
      '        更新 src/lib/essence-import/protocol.ts 的 version/adaptedAt/upstreamCommit/schemaHash',
    )
    process.exit(1)
  }

  if (!quiet) console.log(`[maaend-protocol] OK：本站适配 v${pinned.version}，与上游一致`)
}

// tsx compiles this to CJS, where top-level await is not available.
main().catch((error: unknown) => {
  console.error('[maaend-protocol] 未知错误', error)
  process.exit(1)
})
