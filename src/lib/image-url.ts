import { imageHashManifest } from '@/generated/image-hash-manifest'

/**
 * 为图片 URL 附加内容版本号查询参数，用于绕过浏览器旧缓存。
 * 版本号在构建时由 scripts/generate-version.mjs 基于 public/images/ 中每个文件
 * 单独计算 SHA-256 生成，仅内容变动的图片 URL 会变化。
 *
 * 版本参数会插入到任何 # fragment 之前，保留原有 query 与 fragment 不变。
 */
export function withImageCacheVersion(path: string): string {
  // 定位 query (?) 和 fragment (#) 的起始位置
  const queryIndex = path.indexOf('?')
  const fragmentIndex = path.indexOf('#')

  // path 部分在 ? 和 # 中先出现的位置之前
  let pathEnd = path.length
  if (queryIndex !== -1) pathEnd = Math.min(pathEnd, queryIndex)
  if (fragmentIndex !== -1) pathEnd = Math.min(pathEnd, fragmentIndex)
  const rawPath = path.slice(0, pathEnd)

  // 尝试解码路径用于 manifest 查找（路径可能含 URL 编码字符）
  let lookupPath = rawPath
  try {
    lookupPath = decodeURIComponent(rawPath)
  } catch {
    // 解码失败时保留原路径
  }

  const version = imageHashManifest[lookupPath]
  if (!version) return path

  // 在 fragment 之前插入版本参数
  const fragmentStart = fragmentIndex === -1 ? path.length : fragmentIndex
  const beforeFragment = path.slice(0, fragmentStart)
  const fragment = path.slice(fragmentStart)

  const separator = beforeFragment.includes('?') ? '&' : '?'
  return `${beforeFragment}${separator}v=${version}${fragment}`
}
