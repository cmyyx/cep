import { CSS_GUARD_CODE } from '@/components/shared/css-guard'
import { buildDomainGuardCode } from '@/components/shared/domain-guard'

/**
 * postbuild 中间产物 /guard-inline.js: css-guard + domain-guard 的内联代码。
 *
 * 这两段守卫必须内联在每页 <head> 中执行 (css-guard 检测的正是外部资源
 * 加载失败; domain-guard 需在 React 前同步跳转), 但若作为 React 树节点
 * 渲染, 代码字符串会随 RSC flight 在每页 html、<page>.txt 与 _index 段
 * 重复序列化 3 份 (~37MB)。因此改为: 构建导出本文件 →
 * scripts/prune-export.mjs 读取内容插入每个 html 的 <head> 后删除本文件。
 */
export const dynamic = 'force-static'

export function GET() {
  const code = `${CSS_GUARD_CODE}\n${buildDomainGuardCode()}`
  return new Response(code, {
    headers: { 'content-type': 'text/javascript; charset=utf-8' },
  })
}
