import { imageHashManifest } from '@/generated/image-hash-manifest'

/**
 * 为图片 URL 附加内容版本号查询参数，用于绕过浏览器旧缓存。
 * 版本号在构建时由 scripts/generate-version.mjs 基于 public/images/ 中每个文件
 * 单独计算 SHA-256 生成，仅内容变动的图片 URL 会变化。
 */
export function withImageCacheVersion(path: string): string {
  // 分离查询字符串，用纯路径查找 manifest
  const queryIndex = path.indexOf('?')
  const basePath = queryIndex === -1 ? path : path.slice(0, queryIndex)
  const version = imageHashManifest[basePath]
  if (!version) return path
  const separator = queryIndex === -1 ? '?' : '&'
  return `${path}${separator}v=${version}`
}
