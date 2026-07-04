import { versionData } from '@/generated/version-data'

const imageCacheVersion = versionData.imageCacheVersion

/**
 * 为图片 URL 附加内容版本号查询参数，用于绕过浏览器旧缓存。
 * 版本号在构建时由 scripts/generate-version.mjs 基于 public/images/ 目录内容 hash 生成，
 * 任何图片文件变动都会使版本号变化，从而产生新的 URL 绕过旧缓存。
 */
export function withImageCacheVersion(path: string): string {
  return imageCacheVersion ? `${path}?v=${imageCacheVersion}` : path
}
