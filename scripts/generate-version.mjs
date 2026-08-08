import { execSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createHash } from "node:crypto"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const generatedDir = resolve(root, "src", "generated")

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: root, encoding: "utf-8" }).trim()
  } catch {
    return ""
  }
}

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"))
const CHANGELOG_FIELD_SEPARATOR = "\x1f"
const CHANGELOG_RECORD_SEPARATOR = "\x1e"

export function parseChangelog(raw) {
  return raw
    .split(CHANGELOG_RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [commit = "", commitTime = "", decorations = "", ...messageParts] =
        record.split(CHANGELOG_FIELD_SEPARATOR)
      const tags = decorations
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.startsWith("tag: "))
        .map((part) => part.slice(5))
      const releaseMatch = tags
        .map((tag) => tag.match(/^v(\d+\.\d+\.\d+)(-force)?$/))
        .find(Boolean)

      return {
        commit,
        commitTime,
        message: messageParts
          .join(CHANGELOG_FIELD_SEPARATOR)
          .replace(/(Co-authored-by:\s*.*?)\s*<[^>]+>/g, "$1")
          .trim(),
        ...(releaseMatch ? { version: `v${releaseMatch[1]}` } : {}),
        forceUpdate:
          Boolean(releaseMatch?.[2]) || tags.some((tag) => /^force-\d+$/.test(tag)),
      }
    })
}

export function parseForceUpgradeSerial(tags) {
  return tags.split(/\s+/).reduce((highest, tag) => {
    const match = tag.match(/^force-(\d+)$/)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
}

function getForceUpgradeSerial() {
  const injected = Number.parseInt(process.env.FORCE_UPGRADE_SERIAL ?? "", 10)
  if (Number.isSafeInteger(injected) && injected >= 0) return injected
  return parseForceUpgradeSerial(git("tag -l force-*") || "")
}

// 优先从 CI 注入的 DEPLOY_TAG 环境变量读取 semver（构建机可能拉不到完整的 git tags）
// 其次读取当前 HEAD 指向的 tag 中的 semver，本地开发无 tag 时 fallback 到 package.json
function getSemver() {
  // Priority 1: CI-provided tag name (e.g., v1.2.0)
  const ciTag = process.env.DEPLOY_TAG
  if (ciTag) {
    const m = String(ciTag).trim().match(/^v(\d+\.\d+\.\d+)/)
    if (m) return m[1]
  }
  // Priority 2: git tag pointing at HEAD
  const tags = git("tag -l v* --points-at HEAD") || ""
  const lines = tags.split("\n").filter(Boolean)
  for (const tag of lines) {
    const m = tag.trim().match(/^v(\d+\.\d+\.\d+)/)
    if (m) return m[1]
  }
  // Priority 3: package.json version
  return pkg.version || "0.0.0"
}

/**
 * 为静态资源按文件内容计算 hash。URL 只在对应文件内容变化时变化，
 * 避免一个资源修改导致全部资源重新请求。读取失败直接阻断构建。
 * @param {string} directory
 * @param {string} urlPrefix
 * @param {(file: string) => boolean} [includeFile]
 * @returns {Record<string, string>}
 */
export function generateHashManifest(directory, urlPrefix, includeFile = () => true) {
  const manifest = {}
  const walk = (dir) => {
    const files = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    for (const ent of files) {
      const full = resolve(dir, ent.name)
      if (ent.isDirectory()) {
        walk(full)
      } else if (ent.isFile() && includeFile(full)) {
        const rel = full.slice(directory.length).replace(/\\/g, "/")
        const urlPath = `${urlPrefix}${rel}`
        manifest[urlPath] = createHash("sha256")
          .update(readFileSync(full))
          .digest("hex")
          .slice(0, 8)
      }
    }
  }
  walk(directory)
  return manifest
}

export function generateImageManifest() {
  return generateHashManifest(resolve(root, "public", "images"), "/images")
}

export function generateGameI18nManifest() {
  return generateHashManifest(
    resolve(root, "public", "game-i18n"),
    "/game-i18n",
    (file) => file.endsWith(".json"),
  )
}

function main() {
  const changelogRaw = git(
    `log --decorate=short --format="%h%x1f%cI%x1f%D%x1f%B%x1e"`
  )
  const changelog = changelogRaw ? parseChangelog(changelogRaw) : []
  const semver = getSemver()
  const commitHash = git("rev-parse --short HEAD") || "unknown"
  const count = Number(git("rev-list --count HEAD")) || 0
  const derivedVersion = `${semver}-${commitHash}`

  // 轮询用轻量文件，不含 changelog
  const imageManifest = generateImageManifest()
  const gameI18nManifest = generateGameI18nManifest()
  const version = {
    commit: commitHash,
    count,
    commitTime: git("log -1 --format=%cI") || "",
    buildTime: new Date().toISOString(),
    version: derivedVersion,
    forceUpgradeSerial: getForceUpgradeSerial(),
  }

  const outPath = resolve(root, "public", "version.json")
  writeFileSync(outPath, JSON.stringify(version, null, 2))

  // 详细更新日志，按需加载
  const changelogPath = resolve(root, "public", "changelog.json")
  writeFileSync(changelogPath, JSON.stringify({ changelog }, null, 2))

  mkdirSync(generatedDir, { recursive: true })
  const tsPath = resolve(generatedDir, "version-data.ts")
  writeFileSync(tsPath, `// Auto-generated by scripts/generate-version.mjs
import type { VersionInfo } from '@/types/version'

export const versionData: VersionInfo = ${JSON.stringify(version, null, 2)}
`)

  const manifestPath = resolve(generatedDir, "image-hash-manifest.ts")
  writeFileSync(manifestPath, `// Auto-generated by scripts/generate-version.mjs
export const imageHashManifest: Record<string, string> = ${JSON.stringify(imageManifest, null, 2)}
`)

  const gameI18nManifestPath = resolve(generatedDir, "game-i18n-hash-manifest.ts")
  writeFileSync(gameI18nManifestPath, `// Auto-generated by scripts/generate-version.mjs
export const gameI18nHashManifest: Record<string, string> = ${JSON.stringify(gameI18nManifest, null, 2)}
`)

  console.log(`version.json written: ${JSON.stringify(version)}`)
  console.log(`image-hash-manifest.ts written: ${Object.keys(imageManifest).length} entries`)
  console.log(`game-i18n-hash-manifest.ts written: ${Object.keys(gameI18nManifest).length} entries`)
}

const isCli = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false

if (isCli) main()
