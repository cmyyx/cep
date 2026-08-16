import { CSS_GUARD_CODE } from '@/components/shared/css-guard'
import { JS_RESOURCE_GUARD_CODE } from '@/components/shared/js-resource-guard'
import { buildDomainGuardCode } from '@/components/shared/domain-guard'

/**
 * postbuild 中间产物 /guard-inline.js: css-guard + js-resource-guard +
 * domain-guard 的内联代码。
 *
 * 这三段守卫必须内联在每页 <head> 中执行 (css-guard 检测样式资源加载失败;
 * js-resource-guard 检测 /_next/static/ 脚本资源加载失败并兜底重试/错误页;
 * domain-guard 需在 React 前同步跳转), 但若作为 React 树节点
 * 渲染, 代码字符串会随 RSC flight 在每页 html、<page>.txt 与 _index 段
 * 重复序列化 3 份 (~37MB)。因此改为: 构建导出本文件 →
 * scripts/prune-export.mjs 读取内容插入每个 html 的 <head> 后删除本文件。
 */
export const dynamic = 'force-static'

export function GET() {
  const code = `${CSS_GUARD_CODE};\n${JS_RESOURCE_GUARD_CODE};\n${buildDomainGuardCode()}`
  return new Response(code, {
    headers: { 'content-type': 'text/javascript; charset=utf-8' },
  })
}
