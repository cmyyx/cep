/**
 * postbuild: 删除静态导出中从未被客户端请求的 __next._full.txt 重复载荷。
 * (无 shebang: 始终经 `node scripts/prune-export.mjs` 调用;
 *  shebang 行被 git autocrlf 转成 CRLF 后会破坏 vitest 的模块转换。)
 *
 * Next.js 16 静态导出会为每个 App Router 页面同时生成:
 *   - <page>.txt            完整页面 RSC 载荷(客户端非预取导航时请求)
 *   - <page>/__next._full.txt  同一载荷的逐字节副本(collect-segment-data 无条件输出,
 *     本版本 next/dist/client 中没有任何对 /_full 的引用,浏览器永远不会请求它)
 *
 * 删除前逐一与兄弟 <page>.txt 做字节比对, 不一致立即失败——
 * 未来 Next 升级若改变该契约, 构建会在此处大声报错而不是悄悄破坏行为。
 */
import { readdirSync, readFileSync, unlinkSync, existsSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const FULL_PAYLOAD_NAME = '__next._full.txt'

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

/**
 * 校验并删除 outDir 下所有 __next._full.txt。
 * 任何文件缺少兄弟载荷或字节不一致都会抛错(此时不删除任何后续文件)。
 */
export function pruneFullPayloads(outDir) {
  const fullFiles = findFullPayloadFiles(outDir)
  const verified = []
  for (const fullPath of fullFiles) {
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
    verified.push(fullPath)
  }

  let bytes = 0
  for (const fullPath of verified) {
    bytes += statSync(fullPath).size
    unlinkSync(fullPath)
  }
  return { deleted: verified.length, bytes }
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
  const { deleted, bytes } = pruneFullPayloads(outDir)
  const mb = (bytes / 1024 / 1024).toFixed(1)
  console.log(`prune-export: 已删除 ${deleted} 个 ${FULL_PAYLOAD_NAME} 重复载荷, 释放 ${mb} MB`)

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
