import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  findFullPayloadFiles,
  injectInlineGuards,
  pruneDuplicateIconMedia,
  pruneFullPayloads,
  resolveSiblingPagePayload,
} from './prune-export.mjs'

let fixtureDir: string | null = null

function createFixture(): string {
  fixtureDir = mkdtempSync(path.join(tmpdir(), 'prune-export-'))
  return fixtureDir
}

afterEach(() => {
  if (fixtureDir) {
    rmSync(fixtureDir, { recursive: true, force: true })
    fixtureDir = null
  }
})

function writeTree(root: string, files: Record<string, string>) {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, content)
  }
}

describe('pruneFullPayloads', () => {
  it('deletes byte-identical duplicates including the root index.txt case', () => {
    const out = createFixture()
    writeTree(out, {
      'index.txt': 'root-payload',
      '__next._full.txt': 'root-payload',
      '__next._index.txt': 'segment-keep',
      'ja/wiki/characters/chr_a.txt': 'chr-a-payload',
      'ja/wiki/characters/chr_a/__next._full.txt': 'chr-a-payload',
      'ja/wiki/characters/chr_a/__next._tree.txt': 'tree-keep',
      'llms.txt': 'llms-keep',
    })

    const result = pruneFullPayloads(out)

    expect(result.deleted).toBe(2)
    expect(result.bytes).toBe('root-payload'.length + 'chr-a-payload'.length)
    expect(existsSync(path.join(out, '__next._full.txt'))).toBe(false)
    expect(existsSync(path.join(out, 'ja/wiki/characters/chr_a/__next._full.txt'))).toBe(false)
    expect(existsSync(path.join(out, 'index.txt'))).toBe(true)
    expect(existsSync(path.join(out, 'ja/wiki/characters/chr_a.txt'))).toBe(true)
    expect(existsSync(path.join(out, '__next._index.txt'))).toBe(true)
    expect(existsSync(path.join(out, 'ja/wiki/characters/chr_a/__next._tree.txt'))).toBe(true)
    expect(existsSync(path.join(out, 'llms.txt'))).toBe(true)
  })

  it('aborts without deleting anything when contents differ', () => {
    const out = createFixture()
    writeTree(out, {
      'about.txt': 'expected-payload',
      'about/__next._full.txt': 'divergent-payload',
    })

    expect(() => pruneFullPayloads(out)).toThrow(/字节不一致/)
    expect(existsSync(path.join(out, 'about/__next._full.txt'))).toBe(true)
  })

  it('aborts when the sibling page payload is missing', () => {
    const out = createFixture()
    writeTree(out, {
      'orphan/__next._full.txt': 'payload-without-sibling',
    })

    expect(() => pruneFullPayloads(out)).toThrow(/兄弟文件/)
    expect(existsSync(path.join(out, 'orphan/__next._full.txt'))).toBe(true)
  })
})

describe('resolveSiblingPagePayload', () => {
  it('prefers the route-level txt and falls back to index.txt inside the directory', () => {
    const out = createFixture()
    writeTree(out, {
      'ja/about.txt': 'route-level',
      'ja/about/__next._full.txt': 'route-level',
      'index.txt': 'root',
      '__next._full.txt': 'root',
    })

    expect(resolveSiblingPagePayload(path.join(out, 'ja/about/__next._full.txt'))).toBe(
      path.join(out, 'ja/about.txt'),
    )
    expect(resolveSiblingPagePayload(path.join(out, '__next._full.txt'))).toBe(
      path.join(out, 'index.txt'),
    )
    expect(resolveSiblingPagePayload(path.join(out, 'missing/__next._full.txt'))).toBeNull()
  })
})

describe('injectInlineGuards', () => {
  const guardCode = "(function(){var g='guard'})()"

  it('injects the guard script after the charset meta and deletes the source file', () => {
    const out = createFixture()
    writeTree(out, {
      'guard-inline.js': guardCode,
      'ja/about.html': '<!DOCTYPE html><html><head><meta charSet="utf-8"/><link rel="stylesheet" href="/a.css"/></head><body></body></html>',
      'index.html': '<!DOCTYPE html><html><head><meta charset="utf-8"><title>x</title></head><body></body></html>',
    })

    const result = injectInlineGuards(out)

    expect(result.injected).toBe(2)
    const about = readFileSync(path.join(out, 'ja/about.html'), 'utf-8')
    const charsetEnd = about.indexOf('/>') + 2
    expect(about.slice(charsetEnd)).toMatch(/^<script id="inline-guards">/)
    expect(about.indexOf('<script id="inline-guards">')).toBeLessThan(about.indexOf('<link'))
    expect(about).toContain(guardCode)
    expect(existsSync(path.join(out, 'guard-inline.js'))).toBe(false)
  })

  it('is idempotent for already-injected html', () => {
    const out = createFixture()
    writeTree(out, {
      'guard-inline.js': guardCode,
      'a.html': `<html><head><meta charset="utf-8"><script id="inline-guards">${guardCode}</script></head><body></body></html>`,
    })

    const result = injectInlineGuards(out)
    expect(result.injected).toBe(0)
    const html = readFileSync(path.join(out, 'a.html'), 'utf-8')
    expect(html.match(/inline-guards/g)).toHaveLength(1)
  })

  it('fails loudly when the guard source file is missing', () => {
    const out = createFixture()
    writeTree(out, { 'a.html': '<html><head></head><body></body></html>' })

    expect(() => injectInlineGuards(out)).toThrow(/guard-inline\.js/)
  })

  it('rejects guard code that would break out of the script tag', () => {
    const out = createFixture()
    writeTree(out, {
      'guard-inline.js': "var x='</script>'",
      'a.html': '<html><head><meta charset="utf-8"></head><body></body></html>',
    })

    expect(() => injectInlineGuards(out)).toThrow(/script/)
  })
})

describe('pruneDuplicateIconMedia', () => {
  it('removes fingerprinted icon copies but keeps other media and root icons', () => {
    const out = createFixture()
    writeTree(out, {
      '_next/static/media/icon.0~m7g7xwg1sgx.svg': 'svg-copy',
      '_next/static/media/apple-icon.0hds12ab.png': 'png-copy',
      '_next/static/media/favicon.0-abc123.ico': 'ico-copy',
      '_next/static/media/some-font.abc123.woff2': 'font-keep',
      'icon.svg': 'root-icon-keep',
    })

    const result = pruneDuplicateIconMedia(out)

    expect(result.deleted).toBe(3)
    expect(existsSync(path.join(out, '_next/static/media/some-font.abc123.woff2'))).toBe(true)
    expect(existsSync(path.join(out, 'icon.svg'))).toBe(true)
    expect(existsSync(path.join(out, '_next/static/media/icon.0~m7g7xwg1sgx.svg'))).toBe(false)
  })

  it('is a no-op without a media directory', () => {
    const out = createFixture()
    expect(pruneDuplicateIconMedia(out)).toEqual({ deleted: 0, bytes: 0 })
  })
})

describe('findFullPayloadFiles', () => {
  it('collects only __next._full.txt files recursively', () => {
    const out = createFixture()
    writeTree(out, {
      '__next._full.txt': 'a',
      'ja/__next._full.txt': 'b',
      'ja/__next._index.txt': 'not-me',
      'ja/wiki/chr/__next._full.txt': 'c',
      'llms-full.txt': 'not-me-either',
    })

    const files = findFullPayloadFiles(out).map((file) => path.relative(out, file))

    expect(files).toEqual([
      '__next._full.txt',
      path.join('ja', '__next._full.txt'),
      path.join('ja', 'wiki', 'chr', '__next._full.txt'),
    ])
  })
})
