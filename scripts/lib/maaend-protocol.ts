/**
 * MaaEND protocol drift logic (pure, unit-tested).
 *
 * Split out of the CLI so tests can import it: a `.mjs` entry point carrying a
 * shebang cannot be imported by the bundler used in the test run.
 */

/** Upstream schema this repo pins against. */
export const MAAEND_SCHEMA_URL =
  'https://raw.githubusercontent.com/MaaEnd/MaaEnd/refs/heads/v2/tools/schema/essence_inventory.schema.json'

/** A stalled connection must not burn the whole CI job. */
export const FETCH_TIMEOUT_MS = 10_000

export interface PinnedProtocol {
  format: string | null
  version: number
  schemaHash: string | null
}

export interface UpstreamProtocol {
  format?: unknown
  version?: unknown
  /** sha256 of the fetched schema text. */
  hash?: string
}

export interface ProtocolComparison {
  /** Fail the build: the pinned protocol no longer matches upstream. */
  errors: string[]
  /** Print only: same-version text changes and other non-breaking drift. */
  warnings: string[]
}

/** Read the pinned baseline out of `protocol.ts` (no TS loader needed). */
export function readPinnedProtocol(source: string): PinnedProtocol {
  const first = (pattern: RegExp) => source.match(pattern)?.[1] ?? null
  return {
    format: first(/MAAEND_INVENTORY_FORMAT\s*=\s*'([^']+)'/),
    // `version: 1` is a bare number; the other pins are quoted strings
    version: Number(first(/\bversion:\s*(\d+),/)),
    schemaHash: first(/\bschemaHash:\s*'([0-9a-f]+)'/),
  }
}

/**
 * Compare the pinned baseline with what upstream currently publishes.
 */
export function compareProtocol(pinned: PinnedProtocol, upstream: UpstreamProtocol): ProtocolComparison {
  const errors: string[] = []
  const warnings: string[] = []

  if (!pinned.format) errors.push('protocol.ts: MAAEND_INVENTORY_FORMAT 解析不出来（常量被改名了？）')
  if (!Number.isInteger(pinned.version)) errors.push('protocol.ts: MAAEND_PROTOCOL.version 解析不出来')
  if (!pinned.schemaHash) errors.push('protocol.ts: MAAEND_PROTOCOL.schemaHash 缺失')

  // A missing or relocated upstream marker is drift too: silently skipping the
  // comparison is how this gate would print OK while the protocol identifier is
  // gone.
  if (!upstream.format) {
    errors.push('上游 schema 缺少 format 常量（properties.format.const），协议标识可能已被移除或搬家')
  }
  if (!Number.isInteger(upstream.version)) {
    errors.push('上游 schema 缺少 version 常量（properties.version.const），版本标记可能已被移除或搬家')
  }

  if (upstream.format && pinned.format && upstream.format !== pinned.format) {
    errors.push(`协议标识变化：上游 "${String(upstream.format)}" ≠ 本站 "${pinned.format}"`)
  }
  if (
    Number.isInteger(pinned.version) &&
    Number.isInteger(upstream.version) &&
    upstream.version !== pinned.version
  ) {
    errors.push(`协议版本变化：上游 v${String(upstream.version)} ≠ 本站适配 v${pinned.version}`)
  }
  if (
    upstream.hash &&
    pinned.schemaHash &&
    upstream.hash !== pinned.schemaHash &&
    Number.isInteger(upstream.version) &&
    upstream.version === pinned.version
  ) {
    warnings.push(
      `schema 文本已变动（同一版本 v${pinned.version}）：上游承诺同版本内只新增可选字段与枚举值；` +
        '若解析器需要跟进，更新 schemaHash 即可',
    )
  }

  return { errors, warnings }
}
