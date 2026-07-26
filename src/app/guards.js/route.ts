import { DEBUG_BOOTSTRAP_CODE } from '@/lib/debug/bootstrap'
import { BROWSER_GUARD_CODE } from '@/components/shared/browser-guard'

/**
 * 静态导出的外置 guard 脚本 (/guards.js)。
 *
 * debug bootstrap (~7KB) 与浏览器能力检测 (~9KB) 此前内联在每页 <head>,
 * 且随 RSC flight 树在每页 html 与 <page>.txt 中再序列化一份 (双倍发货)。
 * 外置后每访客仅下载/缓存一次; 引用见 src/app/layout.tsx (带 ?v= 缓存失效)。
 *
 * 注意: 两段代码必须保持 ES5 语法 — 文件级 SyntaxError 会让旧浏览器
 * 无法执行 BrowserGuard, 而它正是给旧浏览器看的。
 * 必须保持内联的守卫: theme-fouc / no-js / CssGuard (检测资源加载失败,
 * 外置即自我失效) / LocaleGuardHead / DomainGuard。
 */
export const dynamic = 'force-static'

export function GET() {
  const code = `${BROWSER_GUARD_CODE}\n${DEBUG_BOOTSTRAP_CODE}`
  return new Response(code, {
    headers: { 'content-type': 'text/javascript; charset=utf-8' },
  })
}
