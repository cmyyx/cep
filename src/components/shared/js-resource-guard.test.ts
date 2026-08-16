import { describe, expect, it } from 'vitest'
import vm from 'node:vm'
import { isCriticalResourceUrl, JS_RESOURCE_GUARD_CODE, resolveGuardLocale } from './js-resource-guard'

describe('isCriticalResourceUrl', () => {
  it('matches /_next/static/ script and css resources', () => {
    expect(isCriticalResourceUrl('https://example.com/_next/static/chunks/0abc123.js')).toBe(true)
    expect(isCriticalResourceUrl('/_next/static/chunks/main-abc.js')).toBe(true)
    expect(isCriticalResourceUrl('https://example.com/_next/static/css/xyz.css')).toBe(true)
  })

  it('matches the guards script with its cache-buster query', () => {
    expect(isCriticalResourceUrl('/guards.js?v=949dcfb52')).toBe(true)
    expect(isCriticalResourceUrl('https://example.com/guards.js')).toBe(true)
  })

  it('ignores external analytics and other origins', () => {
    expect(isCriticalResourceUrl('https://hm.baidu.com/hm.js?abc')).toBe(false)
    expect(isCriticalResourceUrl('https://www.clarity.ms/tag/x')).toBe(false)
    expect(isCriticalResourceUrl('https://end-ops.canmoe.com/api/v1/bootstrap.js')).toBe(false)
    expect(isCriticalResourceUrl('https://static.cloudflareinsights.com/beacon.min.js')).toBe(false)
  })
})

describe('resolveGuardLocale', () => {
  it('resolves the four locale route prefixes (case-insensitive)', () => {
    expect(resolveGuardLocale('/zh-CN/essence-planner')).toBe('zh-CN')
    expect(resolveGuardLocale('/zh-TW/wiki/weapons')).toBe('zh-TW')
    expect(resolveGuardLocale('/ja/growth-planner')).toBe('ja')
    expect(resolveGuardLocale('/en/')).toBe('en')
    expect(resolveGuardLocale('/ZH-CN/x')).toBe('zh-CN')
  })

  it('returns null outside locale routes (404, root)', () => {
    expect(resolveGuardLocale('/404.html')).toBeNull()
    expect(resolveGuardLocale('/')).toBeNull()
    expect(resolveGuardLocale('/foo/bar')).toBeNull()
    expect(resolveGuardLocale('')).toBeNull()
  })
})

describe('JS_RESOURCE_GUARD_CODE', () => {
  it('embeds the critical URL matcher, locale resolver and reload-once semantics', () => {
    expect(JS_RESOURCE_GUARD_CODE).toContain('/_next/static/')
    expect(JS_RESOURCE_GUARD_CODE).toContain("'cep-chunk-reload-once'")
    expect(JS_RESOURCE_GUARD_CODE).toContain('data-cep-hydrated')
    expect(JS_RESOURCE_GUARD_CODE).toContain('cep-js-fatal')
    expect(JS_RESOURCE_GUARD_CODE).toContain('location.reload')
    expect(JS_RESOURCE_GUARD_CODE).toContain('addEventListener')
  })

  it('contains the four-locale copy table and the environment-info block', () => {
    expect(JS_RESOURCE_GUARD_CODE).toContain('zh-TW')
    expect(JS_RESOURCE_GUARD_CODE).toContain('"ja"')
    // Environment info is embedded as executable code (same as css-guard),
    // so the block's own source (navigator.userAgent) is present in the code
    // but is never rendered as text — the dom test asserts that.
    expect(JS_RESOURCE_GUARD_CODE).toContain('navigator.userAgent')
  })

  it('does not rely on inline onclick attributes (CSP script-src-attr safe)', () => {
    expect(JS_RESOURCE_GUARD_CODE).not.toContain('onclick=')
  })

  it('does not contain newlines (single-line inline injection)', () => {
    expect(JS_RESOURCE_GUARD_CODE.includes('\n')).toBe(false)
  })

  it('escapes overlay HTML safely', () => {
    expect(JS_RESOURCE_GUARD_CODE).toContain('String(s).replace(/&/g')
  })

  it('generated inline guard code is valid JavaScript (vm.Script compile-only)', () => {
    // 编译而不执行:任何语法错误(如嵌入函数经去换行折叠后粘连)都会在此失败。
    // 守卫代码由 toString() 嵌入并经正则折叠成一行,必须始终可解析。
    expect(() => new vm.Script(JS_RESOURCE_GUARD_CODE)).not.toThrow()
  })

  it('resolveGuardLocale survives newline-collapse as raw source', () => {
    // 模拟 toString() 嵌入后整段守卫代码的折叠处理(不经打包器):
    // 函数体是单一 return 表达式,折叠后不会出现相邻语句粘连。
    const collapsed = resolveGuardLocale.toString().replace(/\n\s*/g, '')
    expect(() => new vm.Script(`(${collapsed})`)).not.toThrow()
    expect(collapsed).not.toMatch(/return[^;{}]*\b(?:const|if|return)\b/)
  })
})
