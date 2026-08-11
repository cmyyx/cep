/**
 * postbuild: 删除静态导出中从未被客户端请求的 __next.* 分段载荷。
 * (无 shebang: 始终经 `node scripts/prune-export.mjs` 调用;
 *  shebang 行被 git autocrlf 转成 CRLF 后会破坏 vitest 的模块转换。)
 *
 * Next.js 16 静态导出会为每个 App Router 页面生成两套数据:
 *   - <page>.txt   完整页面 RSC 载荷(客户端导航实际请求的唯一文件)
 *   - <page>/__next.*  逐层分段载荷(_full / _tree / _index / _head 及
 *     $d$locale 参数化目录树), 由 collect-segment-data 无条件输出
 *
 * 分段载荷仅在 per-segment prefetching 生效时才会被请求, 而该能力由
 * next.config 的 `cacheComponents` 开启(config-shared.d.ts 默认 false, 本项目未开)。
 * 关闭时 client/components/segment-cache/scheduler.js 走 FetchStrategy.LoadingBoundary
 * 分支, 只请求 <page>.txt。已用 Playwright 在 `serve out` 上实测确认:
 * 从 /zh-CN/wiki/characters 软导航进角色详情页, 网络面板仅出现
 * `chr_0004_pelica.txt?_rsc=...`, 零个 __next.* 请求。
 *
 * 删除前逐一将 __next._full.txt 与兄弟 <page>.txt 做字节比对, 不一致立即失败——
 * 未来 Next 升级或开启 cacheComponents 若改变该契约,
 * 构建会在此处大声报错而不是悄悄破坏导航行为。
 */
import { readdirSync, readFileSync, rmSync, unlinkSync, existsSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const FULL_PAYLOAD_NAME = '__next._full.txt'

/** 分段载荷的目录/文件前缀: __next._full.txt / __next._tree.txt / __next.$d$locale/ 等。 */
const SEGMENT_PREFIX = '__next.'

/** 递归收集 outDir 下所有 __next._full.txt 的绝对路径。 */
export function findFullPayloadFiles(outDir) {
  const found = []
  const stack = [outDir]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
      } else if (entry.name === FULL_PAYLOAD_NAME) {
        found.push(entryPath)
      }
    }
  }
  return found.sort()
}

/**
 * 递归收集 outDir 下所有分段载荷条目 (以 `__next.` 开头的文件或目录)。
 * 命中目录后不再向下递归——整棵子树都会被删除。
 */
export function findSegmentEntries(outDir) {
  const found = []
  const stack = [outDir]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)
      if (entry.name.startsWith(SEGMENT_PREFIX)) {
        found.push(entryPath)
      } else if (entry.isDirectory()) {
        stack.push(entryPath)
      }
    }
  }
  return found.sort()
}

/**
 * __next._full.txt 对应的整页载荷文件:
 *   out/.../route/__next._full.txt -> out/.../route.txt
 *   out/__next._full.txt           -> out/index.txt (根路由)
 */
export function resolveSiblingPagePayload(fullPath) {
  const routeDir = path.dirname(fullPath)
  const candidates = [
    `${routeDir}.txt`,
    path.join(routeDir, 'index.txt'),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

/** 递归累加一个文件或目录的字节数与文件个数。 */
function measure(entryPath) {
  const stats = statSync(entryPath)
  if (stats.isFile()) return { bytes: stats.size, files: 1 }
  let bytes = 0
  let files = 0
  for (const entry of readdirSync(entryPath, { withFileTypes: true })) {
    const child = measure(path.join(entryPath, entry.name))
    bytes += child.bytes
    files += child.files
  }
  return { bytes, files }
}

/**
 * 校验并删除 outDir 下所有 __next.* 分段载荷。
 *
 * 校验只针对 __next._full.txt: 它必须与兄弟 <page>.txt 逐字节一致。
 * 该文件是整页载荷的副本, 因此是检验"导出契约未变"的最强信号——
 * 一旦 Next 改变分段协议或 cacheComponents 被开启, 这里会先炸。
 * 缺少兄弟载荷或字节不一致都会抛错, 且在删除任何文件之前抛出。
 */
export function pruneSegmentPayloads(outDir) {
  for (const fullPath of findFullPayloadFiles(outDir)) {
    const siblingPath = resolveSiblingPagePayload(fullPath)
    if (!siblingPath) {
      throw new Error(
        `prune-export: ${fullPath} 没有对应的 <page>.txt 兄弟文件, Next 导出契约可能已变化, 中止删除`,
      )
    }
    if (!readFileSync(fullPath).equals(readFileSync(siblingPath))) {
      throw new Error(
        `prune-export: ${fullPath} 与 ${siblingPath} 字节不一致, Next 导出契约可能已变化, 中止删除`,
      )
    }
  }

  let bytes = 0
  let files = 0
  let entries = 0
  for (const entryPath of findSegmentEntries(outDir)) {
    const measured = measure(entryPath)
    bytes += measured.bytes
    files += measured.files
    entries += 1
    rmSync(entryPath, { recursive: true, force: true })
  }
  return { deleted: entries, files, bytes }
}

const GUARD_INLINE_FILE = 'guard-inline.js'
const GUARD_SCRIPT_ID = 'inline-guards'

/** 递归收集 outDir 下所有 .html 文件。 */
export function findHtmlFiles(outDir) {
  const found = []
  const stack = [outDir]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
      } else if (entry.name.endsWith('.html')) {
        found.push(entryPath)
      }
    }
  }
  return found.sort()
}

/**
 * 将 /guard-inline.js (css-guard + domain-guard, 见 src/app/guard-inline.js/route.ts)
 * 的内容作为内联 <script> 插入每个导出 html 的 <head>, 然后删除该中间产物。
 *
 * 插入点在 charset meta 之后 (保证 charset 停留在文件前 1024 字节内)、
 * 样式表 <link> 之前 (css-guard 的错误监听必须先于样式链接注册)。
 * 守卫代码不再进入 React 树, 因此不会随 RSC flight 序列化进 txt 载荷。
 */
export function injectInlineGuards(outDir) {
  const guardPath = path.join(outDir, GUARD_INLINE_FILE)
  if (!existsSync(guardPath)) {
    throw new Error(
      `prune-export: 未找到 out/${GUARD_INLINE_FILE} — 守卫已不在 React 树中, 缺少注入源会导致所有页面失去 css/domain guard`,
    )
  }
  const code = readFileSync(guardPath, 'utf-8')
  if (code.includes('</script>')) {
    throw new Error('prune-export: guard 代码包含 </script>, 无法安全内联')
  }
  const scriptTag = `<script id="${GUARD_SCRIPT_ID}">${code}</script>`

  let injected = 0
  let bytes = 0
  for (const htmlPath of findHtmlFiles(outDir)) {
    const html = readFileSync(htmlPath, 'utf-8')
    if (html.includes(`id="${GUARD_SCRIPT_ID}"`)) continue
    const charsetMatch = html.match(/<meta\s+charset=['"]?[\w-]+['"]?\s*\/?>/i)
    let insertAt
    if (charsetMatch) {
      insertAt = charsetMatch.index + charsetMatch[0].length
    } else {
      const headMatch = html.match(/<head[^>]*>/i)
      if (!headMatch) {
        throw new Error(`prune-export: ${htmlPath} 缺少 <head>, 无法注入守卫`)
      }
      insertAt = headMatch.index + headMatch[0].length
    }
    writeFileSync(htmlPath, html.slice(0, insertAt) + scriptTag + html.slice(insertAt))
    injected += 1
    bytes += scriptTag.length
  }

  unlinkSync(guardPath)
  return { injected, bytes }
}

/** _next/static/media 下的图标副本: 页面只引用根路径 /icon.svg 等, 这些指纹副本无引用。 */
const ICON_MEDIA_RE = /^(icon|apple-icon|favicon)\.[\w~-]+\.(svg|png|ico)$/

/**
 * 删除 out/_next/static/media 中未被引用的图标指纹副本 (约 2.6MB,
 * 其中 icon.*.svg 为 2.5MB 的 base64 位图 SVG)。
 * metadata 文件约定 (src/app/icon.svg 等) 同时以根路径静态文件交付,
 * html 中引用的始终是根路径版本。
 */
export function pruneDuplicateIconMedia(outDir) {
  const mediaDir = path.join(outDir, '_next', 'static', 'media')
  if (!existsSync(mediaDir)) return { deleted: 0, bytes: 0 }
  let deleted = 0
  let bytes = 0
  for (const entry of readdirSync(mediaDir, { withFileTypes: true })) {
    if (!entry.isFile() || !ICON_MEDIA_RE.test(entry.name)) continue
    const entryPath = path.join(mediaDir, entry.name)
    bytes += statSync(entryPath).size
    unlinkSync(entryPath)
    deleted += 1
  }
  return { deleted, bytes }
}

function main() {
  const outDir = path.resolve(process.cwd(), 'out')
  if (!existsSync(outDir)) {
    console.log('prune-export: 未找到 out/ 目录, 跳过')
    return
  }
  const { deleted, files, bytes } = pruneSegmentPayloads(outDir)
  const mb = (bytes / 1024 / 1024).toFixed(1)
  console.log(
    `prune-export: 已删除 ${deleted} 个 ${SEGMENT_PREFIX}* 分段载荷条目 (${files} 个文件), 释放 ${mb} MB`,
  )

  const guards = injectInlineGuards(outDir)
  console.log(
    `prune-export: 已向 ${guards.injected} 个 html 注入内联守卫 (+${(guards.bytes / 1024 / 1024).toFixed(1)} MB, 换取 flight 载荷中约 3 份重复副本的移除)`,
  )

  const media = pruneDuplicateIconMedia(outDir)
  if (media.deleted > 0) {
    console.log(
      `prune-export: 已删除 ${media.deleted} 个未引用的图标指纹副本, 释放 ${(media.bytes / 1024 / 1024).toFixed(1)} MB`,
    )
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
