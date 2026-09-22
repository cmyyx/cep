/**
 * postbuild: 把 out/index.html 变成零 JS 的静态跳转页。
 *
 * 背景 (2026-09 性能实测):
 *   根路径 / 原本是 'use client' 的 RootRedirect, 唯一职责是
 *   router.replace('/<locale>')。代价是浏览器必须先下载 18 个 chunk
 *   (1303 KB 原始 / 383 KB gzip) 并水合 React 才能发起跳转 —— Slow 4G 下
 *   仅"React 水合完成"就要 4.4 s。更糟的是 src/app/page.tsx 里 2000 ms 的兜底
 *   计时器: App Router 的 URL 要等 RSC 载荷落地才更新, 所以慢网下"正常但慢"
 *   与"失败"无法区分, 兜底会把软导航降级成整页重载, 再付一遍全部成本。
 *
 *   app/page.tsx 已改为 Server Component, 跳转逻辑变成 <head> 内联脚本
 *   (见 src/lib/root-redirect.ts)。本脚本负责把导出产物里剩下的框架 JS 剥掉:
 *   chunk <script>、对应的 preload、以及 RSC flight 载荷。
 *
 * 保留不动的东西 (有意为之):
 *   - <link rel="stylesheet"> : 跳转前的 splash 需要样式; 且跳转脚本在
 *     <head> 中位于样式表之前, 不会被样式表阻塞。
 *   - 字体 preload / icon preload : 保证 splash 首帧与旧版观感一致。
 *   - guard-inline (css/domain guard) 与 /guards.js : 行为与其它页面保持一致。
 *     js-resource-guard 在无 chunk 的页面上不会误报 —— 它的 tryAudit 首行是
 *     `if(F.length===0)return`, 而 F 只由关键资源加载失败填充。
 *   - /guards.js 与 ops bootstrap.js : 均为 async, 不阻塞解析。
 *
 * 契约校验 (必须):
 *   改写前断言产物里确实存在 chunk script 与 RSC 载荷, 改写后断言它们确实
 *   消失、且关键内容仍在。Next 升级若改变导出结构, 这里会大声失败, 而不是
 *   悄悄产出一个坏掉的首页 —— 与 prune-export.mjs 对 __next._full.txt 的
 *   字节比对同一思路。
 *
 * 幂等 (必须):
 *   已经剥离过的 index.html (chunk script 与 RSC 载荷都不在了) 视为"已完成",
 *   只重做搬移并直接返回, 不再报错 —— postbuild 重复执行 (本地 pnpm build
 *   复用 out/) 不该失败。只有"一半"的状态 (两者只剩其一) 才是契约变化, 那时
 *   照旧中止。
 *
 * index.txt (首页 RSC flight 的独立文件) 一并删除: 它复制了同一份 chunk 清单,
 *   而应用内没有任何指向 / 的 <Link>, 唯一可能请求它的客户端软导航在当前设计下
 *   本来就该退化成整页加载 (静态页会立刻跳转)。留着它反而会让"以后有人加一个
 *   指向 / 的链接"变成把 splash 渲染进应用外壳里。
 */
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ENTRY_FILE = 'index.html'
/** 独立落盘的首页 RSC flight 载荷 (只有客户端软导航会请求它)。 */
const RSC_ENTRY_FILE = 'index.txt'
const REDIRECT_SCRIPT_ID = 'root-redirect'

/** Next 的 chunk <script src="/_next/static/chunks/...">(含 noModule / id="_R_" 变体)。 */
const CHUNK_SCRIPT_RE = /<script[^>]*src="\/_next\/static\/chunks\/[^"]*"[^>]*><\/script>/g
/** Next 为 chunk 生成的 <link rel="preload" as="script" ...>(样式表链接没有 as=, 不受影响)。 */
const CHUNK_PRELOAD_RE = /<link[^>]*as="script"[^>]*\/?>/g
/** RSC flight 载荷: <script>self.__next_f.push(...)</script> 及其初始化语句。 */
const RSC_PAYLOAD_RE = /<script>(?:\(?self\.__next_f[\s\S]*?)<\/script>/g

/** 抽取指定 id 的内联 <script> 整段 (含标签)。 */
export function extractScriptById(html, id) {
  const match = html.match(new RegExp(`<script id="${id}"[^>]*>[\\s\\S]*?</script>`))
  return match ? match[0] : null
}

/**
 * 把 out/index.html 重写为零 JS 静态跳转页。
 *
 * 返回字节统计, 供 postbuild 日志使用。任何契约不符都抛错且不写文件。
 */
export function optimizeRootEntry(outDir) {
  const entryPath = path.join(outDir, ENTRY_FILE)
  if (!existsSync(entryPath)) {
    throw new Error(`optimize-root-entry: 未找到 out/${ENTRY_FILE}`)
  }

  const before = readFileSync(entryPath, 'utf-8')
  const bytesBefore = statSync(entryPath).size

  // ── 契约校验: 改写前 ──────────────────────────────────────────────
  const redirectScript = extractScriptById(before, REDIRECT_SCRIPT_ID)
  if (!redirectScript) {
    throw new Error(
      `optimize-root-entry: out/${ENTRY_FILE} 缺少 id="${REDIRECT_SCRIPT_ID}" 内联脚本 — ` +
        `app/page.tsx 的 HeadScript 是跳转的唯一实现, 缺失会导致首页停在 splash 不跳转`,
    )
  }
  if (!redirectScript.endsWith('</script>')) {
    throw new Error(`optimize-root-entry: ${REDIRECT_SCRIPT_ID} 内联脚本结构异常`)
  }

  const chunkScripts = before.match(CHUNK_SCRIPT_RE) ?? []
  const rscPayloads = before.match(RSC_PAYLOAD_RE) ?? []
  // Already stripped by an earlier postbuild run: both the chunk scripts and
  // the RSC payload are gone while the redirect script is still there. The
  // hoist below is re-applied either way, which is what makes this idempotent.
  const alreadyOptimized = chunkScripts.length === 0 && rscPayloads.length === 0
  if (!alreadyOptimized && (chunkScripts.length === 0 || rscPayloads.length === 0)) {
    // Half-stripped output is a contract change, not a repeat run: fail loudly.
    const missing = chunkScripts.length === 0 ? 'chunk 脚本' : 'RSC flight 载荷'
    throw new Error(
      `optimize-root-entry: out/${ENTRY_FILE} 只缺少${missing} — ` +
        `Next 导出契约可能已变化, 中止改写`,
    )
  }

  // ── 1. 把跳转脚本搬到 <head> 最前 ─────────────────────────────────
  // 同步内联脚本会被它之前的样式表阻塞, 因此必须排在样式表 <link> 之前;
  // 同时也要排在 chunk <script> 之前, 否则浏览器会先发起一批注定被中止的
  // chunk 请求 (实测 LocaleGuardHead 排在 30 个 chunk 之后时, 重定向瞬间
  // 中止了 31 个请求)。
  let out = before.replace(redirectScript, '')
  const charsetMatch = out.match(/<meta\s+charset=['"]?[\w-]+['"]?\s*\/?>/i)
  if (!charsetMatch) {
    throw new Error(`optimize-root-entry: out/${ENTRY_FILE} 缺少 <meta charset>, 无法定位插入点`)
  }
  const insertAt = charsetMatch.index + charsetMatch[0].length
  out = out.slice(0, insertAt) + redirectScript + out.slice(insertAt)

  // ── 2. 剥离框架 JS ────────────────────────────────────────────────
  out = out.replace(CHUNK_SCRIPT_RE, '')
  out = out.replace(RSC_PAYLOAD_RE, '')
  out = out.replace(CHUNK_PRELOAD_RE, (tag) => (tag.includes('/_next/static/chunks/') ? '' : tag))

  // ── 3. 契约校验: 改写后 ──────────────────────────────────────────
  // Fresh (non-global) regexes: a /g/ regex carries lastIndex between calls,
  // so reusing CHUNK_SCRIPT_RE here would give a wrong answer.
  const leftovers = []
  if (/<script[^>]*src="\/_next\/static\/chunks\/[^"]*"[^>]*><\/script>/.test(out)) {
    leftovers.push('chunk <script>')
  }
  if (/self\.__next_f/.test(out)) leftovers.push('RSC flight 载荷')
  if (leftovers.length > 0) {
    throw new Error(`optimize-root-entry: 剥离后仍残留 ${leftovers.join(' / ')}, 中止改写`)
  }

  const required = [
    [extractScriptById(out, REDIRECT_SCRIPT_ID), '跳转脚本'],
    [/http-equiv="refresh"/i, 'noscript meta refresh'],
    [/<link rel="stylesheet" href="\/_next\/static\/chunks\//, '样式表链接'],
    [/<noscript>/i, 'noscript 语言链接'],
  ]
  for (const [probe, label] of required) {
    if (!probe) throw new Error(`optimize-root-entry: 剥离后丢失${label}, 中止改写`)
  }

  // index.txt first: a crash in between leaves a still-unstripped index.html,
  // which the next run handles in full again.
  const rscEntryPath = path.join(outDir, RSC_ENTRY_FILE)
  const removedRscEntry = existsSync(rscEntryPath)
  if (removedRscEntry) rmSync(rscEntryPath, { force: true })

  writeFileSync(entryPath, out)

  const bytesAfter = Buffer.byteLength(out)
  return {
    path: entryPath,
    bytesBefore,
    bytesAfter,
    alreadyOptimized,
    removedChunkScripts: chunkScripts.length,
    removedRscPayloads: rscPayloads.length,
    removedRscEntry,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outDir = path.resolve(process.argv[2] ?? 'out')
  try {
    const result = optimizeRootEntry(outDir)
    const saved = result.bytesBefore - result.bytesAfter
    if (result.alreadyOptimized) {
      console.log(`optimize-root-entry: ${path.relative(process.cwd(), result.path)} 已处理过, 本次只重做搬移`)
    } else {
      console.log(
        `optimize-root-entry: ${path.relative(process.cwd(), result.path)} ` +
          `${(result.bytesBefore / 1024).toFixed(1)}KB → ${(result.bytesAfter / 1024).toFixed(1)}KB ` +
          `(省 ${(saved / 1024).toFixed(1)}KB, 移除 ${result.removedChunkScripts} 个 chunk script / ` +
          `${result.removedRscPayloads} 段 RSC 载荷)`,
      )
    }
    if (result.removedRscEntry) {
      console.log(`optimize-root-entry: 已删除 ${RSC_ENTRY_FILE} (首页不再有客户端软导航入口)`)
    }
  } catch (error) {
    // A readable one-line diagnosis instead of a raw stack: this runs at the end
    // of a build, where the message is the whole signal.
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
