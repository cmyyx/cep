import { imageHashManifest } from '@/generated/image-hash-manifest'
import { withCacheVersion } from '@/lib/cache-url'

/**
 * 为图片 URL 附加内容版本号查询参数，用于绕过浏览器旧缓存。
 * 版本号在构建时由 scripts/generate-version.mjs 基于 public/images/ 中每个文件
 * 单独计算 SHA-256 生成，仅内容变动的图片 URL 会变化。
 *
 * 版本参数会插入到任何 # fragment 之前，保留原有 query 与 fragment 不变，
 * 并且重复调用时不会产生重复的 v 参数。
 */
export function withImageCacheVersion(path: string): string {
  return withCacheVersion(path, imageHashManifest)
}
