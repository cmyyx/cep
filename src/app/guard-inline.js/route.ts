import { CSS_GUARD_CODE } from '@/components/shared/css-guard'
import { JS_RESOURCE_GUARD_CODE } from '@/components/shared/js-resource-guard'
import { buildDomainGuardCode } from '@/components/shared/domain-guard'
import { LOCALE_GUARD_HEAD_CODE } from '@/lib/locale-guard-code'

/**
 * postbuild 中间产物 /guard-inline.js: css-guard + js-resource-guard +
 * domain-guard + locale-guard 的内联代码。
 *
 * 这四段守卫必须内联在每页 <head> 中执行 (css-guard 检测样式资源加载失败;
 * js-resource-guard 检测 /_next/static/ 脚本资源加载失败并兜底重试/错误页;
 * domain-guard 需在 React 前同步跳转; locale-guard 同理, 需在样式表与 chunk
 * 请求发起前同步跳转, 否则整页重定向会中止一批已在途的 chunk 下载), 但若作为
 * React 树节点渲染, 代码字符串会随 RSC flight 在每页 html、<page>.txt 与
 * _index 段重复序列化 3 份 (~37MB)。因此改为: 构建导出本文件 →
 * scripts/prune-export.mjs 读取内容插入每个 html 的 <head> 后删除本文件。
 *
 * 顺序即优先级, 与重构前各守卫在 React <head> 中的相对顺序保持一致:
 * css-guard → js-resource-guard → domain-guard → locale-guard。
 * 注意: next dev 下本文件不产出, locale 兜底由 [locale]/layout.tsx 的
 * LocaleGuard (useEffect) 承担。
 */
export const dynamic = 'force-static'

export function GET() {
  const code = `${CSS_GUARD_CODE};\n${JS_RESOURCE_GUARD_CODE};\n${buildDomainGuardCode()};\n${LOCALE_GUARD_HEAD_CODE}`
  return new Response(code, {
    headers: { 'content-type': 'text/javascript; charset=utf-8' },
  })
}
