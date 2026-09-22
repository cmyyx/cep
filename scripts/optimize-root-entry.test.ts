import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extractScriptById, optimizeRootEntry } from './optimize-root-entry.mjs'

/**
 * Fixture mirrors the real Next static export shape closely enough to exercise
 * every regex and every contract assertion:
 *   - charset meta, inline guards, stylesheet link
 *   - chunk <script> in all three emitted variants (async / noModule / id)
 *   - a chunk preload, plus a non-chunk preload that must survive
 *   - RSC flight init + payload
 *   - the root-redirect script rendered in <body> by app/page.tsx
 */
const FIXTURE = `<!DOCTYPE html><html lang="en" class="no-js"><head>` +
  `<meta charset="utf-8"/>` +
  `<script id="inline-guards">(function(){var a=1})()</script>` +
  `<script>document.documentElement.classList.remove('no-js')</script>` +
  `<link rel="stylesheet" href="/_next/static/chunks/aa11.css" data-precedence="next"/>` +
  `<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/c1.js"/>` +
  `<script src="/_next/static/chunks/c1.js" async=""></script>` +
  `<script src="/_next/static/chunks/c2.js" noModule=""></script>` +
  `<script src="/_next/static/chunks/c3.js" id="_R_" async=""></script>` +
  `<script src="/guards.js?v=abc" async=""></script>` +
  `<link rel="preload" href="/debug-panel.js" as="script"/>` +
  `</head><body>` +
  `<script id="root-redirect">(function(){location.replace('/zh-CN')})()</script>` +
  `<div>splash</div>` +
  `<noscript><meta http-equiv="refresh" content="0;url=/zh-CN"/><a href="/ja">日本語</a></noscript>` +
  `<script>(self.__next_f=self.__next_f||[]).push([0])</script>` +
  `<script>self.__next_f.push([1,"payload"])</script>` +
  `</body></html>`

let dir: string
let entryPath: string

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'optimize-root-entry-'))
  entryPath = path.join(dir, 'index.html')
  writeFileSync(entryPath, FIXTURE)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const read = () => readFileSync(entryPath, 'utf-8')

describe('optimizeRootEntry', () => {
  it('removes every Next chunk script variant', () => {
    optimizeRootEntry(dir)
    const html = read()
    expect(html).not.toContain('/_next/static/chunks/c1.js')
    expect(html).not.toContain('/_next/static/chunks/c2.js')
    expect(html).not.toContain('/_next/static/chunks/c3.js')
  })

  it('removes the chunk preload but keeps unrelated script preloads', () => {
    optimizeRootEntry(dir)
    const html = read()
    expect(html).not.toContain('as="script" fetchPriority="low"')
    expect(html).toContain('/debug-panel.js')
  })

  it('removes the RSC flight payload', () => {
    optimizeRootEntry(dir)
    expect(read()).not.toContain('self.__next_f')
  })

  it('keeps the stylesheet, inline guards and async third-party scripts', () => {
    const html = (optimizeRootEntry(dir), read())
    expect(html).toContain('<link rel="stylesheet" href="/_next/static/chunks/aa11.css"')
    expect(html).toContain('id="inline-guards"')
    expect(html).toContain('/guards.js?v=abc')
  })

  it('keeps the splash and the no-JS fallback', () => {
    const html = (optimizeRootEntry(dir), read())
    expect(html).toContain('<div>splash</div>')
    expect(html).toContain('http-equiv="refresh"')
    expect(html).toContain('href="/ja"')
  })

  it('hoists the redirect script into <head>, ahead of the stylesheet and chunks', () => {
    optimizeRootEntry(dir)
    const html = read()
    const script = html.indexOf('id="root-redirect"')
    const charset = html.indexOf('<meta charset="utf-8"/>')
    const stylesheet = html.indexOf('rel="stylesheet"')
    const guards = html.indexOf('id="inline-guards"')

    expect(charset).toBeGreaterThanOrEqual(0)
    expect(script).toBeGreaterThan(charset)
    // Ahead of the stylesheet: a synchronous inline script is blocked by any
    // preceding stylesheet, so leaving it later delays the redirect.
    expect(script).toBeLessThan(stylesheet)
    // Ahead of the inline guards so the redirect wins the race.
    expect(script).toBeLessThan(guards)
  })

  it('appears exactly once after hoisting (no duplicate execution)', () => {
    optimizeRootEntry(dir)
    expect(read().match(/id="root-redirect"/g)).toHaveLength(1)
  })

  it('reports the byte saving', () => {
    const result = optimizeRootEntry(dir)
    expect(result.bytesAfter).toBeLessThan(result.bytesBefore)
    expect(result.removedChunkScripts).toBe(3)
    expect(result.removedRscPayloads).toBe(2)
  })

  it('is idempotent: a second run redoes the hoist and changes nothing', () => {
    const first = optimizeRootEntry(dir)
    expect(first.alreadyOptimized).toBe(false)
    const once = read()

    // postbuild must survive being run twice (a local `pnpm build` that reuses
    // out/): both the strip and the removal are no-ops the second time.
    const second = optimizeRootEntry(dir)
    expect(second.alreadyOptimized).toBe(true)
    expect(second.removedChunkScripts).toBe(0)
    expect(read()).toBe(once)
  })

  it('drops the standalone RSC flight file for the entry', () => {
    const rscPath = path.join(dir, 'index.txt')
    writeFileSync(rscPath, '1:"$Sreact.fragment"')

    expect(optimizeRootEntry(dir).removedRscEntry).toBe(true)
    expect(existsSync(rscPath)).toBe(false)
    // Absent already → nothing to report, and no failure.
    expect(optimizeRootEntry(dir).removedRscEntry).toBe(false)
  })

  describe('contract assertions', () => {
    it('fails when the redirect script is missing', () => {
      writeFileSync(entryPath, FIXTURE.replace(/<script id="root-redirect">[\s\S]*?<\/script>/, ''))
      expect(() => optimizeRootEntry(dir)).toThrow(/缺少 id="root-redirect"/)
    })

    it('fails when the chunk scripts are missing (Next export contract changed)', () => {
      writeFileSync(entryPath, FIXTURE.replace(/<script[^>]*src="\/_next\/static\/chunks\/[^"]*"[^>]*><\/script>/g, ''))
      expect(() => optimizeRootEntry(dir)).toThrow(/只缺少chunk 脚本/)
    })

    it('fails when the RSC payload is missing (Next export contract changed)', () => {
      writeFileSync(entryPath, FIXTURE.replace(/<script>(?:\(?self\.__next_f[\s\S]*?)<\/script>/g, ''))
      expect(() => optimizeRootEntry(dir)).toThrow(/只缺少RSC flight 载荷/)
    })

    it('fails when <meta charset> is missing (no safe insertion point)', () => {
      writeFileSync(entryPath, FIXTURE.replace('<meta charset="utf-8"/>', ''))
      expect(() => optimizeRootEntry(dir)).toThrow(/缺少 <meta charset>/)
    })

    it('fails when out/index.html does not exist', () => {
      rmSync(entryPath)
      expect(() => optimizeRootEntry(dir)).toThrow(/未找到 out\/index.html/)
    })

    it('never writes the file when a contract check fails', () => {
      writeFileSync(entryPath, FIXTURE.replace('<meta charset="utf-8"/>', ''))
      const before = read()
      expect(() => optimizeRootEntry(dir)).toThrow()
      expect(read()).toBe(before)
    })
  })
})

describe('extractScriptById', () => {
  it('returns the whole element including tags', () => {
    expect(extractScriptById('<p>x</p><script id="a">1</script>', 'a')).toBe('<script id="a">1</script>')
  })

  it('returns null when absent', () => {
    expect(extractScriptById('<p>x</p>', 'a')).toBeNull()
  })
})
