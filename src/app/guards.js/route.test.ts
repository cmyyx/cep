import { expect, it } from 'vitest'
import { GET } from './route'
import { BROWSER_GUARD_CODE } from '@/components/shared/browser-guard'
import { DEBUG_BOOTSTRAP_CODE } from '@/lib/debug/bootstrap'

it('serves the combined guard code as javascript', async () => {
  const response = GET()
  expect(response.headers.get('content-type')).toContain('text/javascript')

  const body = await response.text()
  expect(body).toContain(BROWSER_GUARD_CODE)
  expect(body).toContain(DEBUG_BOOTSTRAP_CODE)
  // BrowserGuard 必须先执行: 旧浏览器检测不依赖 bootstrap
  expect(body.indexOf(BROWSER_GUARD_CODE)).toBeLessThan(body.indexOf(DEBUG_BOOTSTRAP_CODE))
})

it('emitted code stays ES5-parseable for outdated browsers', () => {
  const code = `${BROWSER_GUARD_CODE}\n${DEBUG_BOOTSTRAP_CODE}`
  // 文件级 SyntaxError 会让 BrowserGuard 在旧浏览器上无法执行
  expect(code).not.toContain('=>')
  expect(code).not.toContain('`')
  expect(code).not.toMatch(/\bconst\s/)
  expect(code).not.toMatch(/\blet\s/)
})
